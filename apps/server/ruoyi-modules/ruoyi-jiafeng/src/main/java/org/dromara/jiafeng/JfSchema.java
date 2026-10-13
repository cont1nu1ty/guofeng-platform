package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import cn.hutool.crypto.digest.BCrypt;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JfSchema implements ApplicationRunner {
  private final JfStore store;
  private final DataSource dataSource;
  private final String password;
  private final boolean development;

  public JfSchema(
      JfStore store,
      DataSource source,
      @Value("${JIAFENG_DEV_PASSWORD:}") String password,
      @Value("${jiafeng.dev-login:false}") boolean development) {
    this.store = store;
    this.dataSource = source;
    this.password = password;
    this.development = development;
  }

  private volatile boolean initialized;

  public boolean ready() {
    return initialized;
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    try (Connection connection = dataSource.getConnection()) {
      migrate(connection);
    }
    seedSetting(
        "reviewFlow",
        m(
            "blind",
            true,
            "deadlineDays",
            7,
            "enabled",
            List.of(true, true, true, true, true, true),
            "ruleVersion",
            "jiafeng-four-v1",
            "flowVersion",
            1));
    seedSetting(
        "platformConfig",
        m(
            "name",
            "家风中华行",
            "subtitle",
            "全国家风文化共建共享平台",
            "contact",
            "平台运营服务台",
            "language",
            "简体中文",
            "regionLabel",
            "全国运营中心",
            "reviewReminder",
            true,
            "draftNotice",
            true,
            "notice",
            "让好家风，成为时代的风景。"));
    seedSetting("homepageConfig", JfCatalog.defaultHomepage());
    if (!development) {
      JfAccess.bootstrapLegacyRoles(store.db());
      initialized = true;
      return;
    }
    require(
        password.length() >= 16,
        500,
        "CONFIGURATION_ERROR",
        "JIAFENG_DEV_PASSWORD 须至少16字符，由部署脚本生成");
    account(10001, "devadmin", "全国管理员", "staff", "all", "national_admin");
    account(10002, "region_zj", "浙江运营", "staff", "zhejiang", "regional_admin");
    account(10003, "region_bj", "北京运营", "staff", "beijing", "regional_admin");
    account(10004, "expert_zj", "浙江评审专家", "staff", "zhejiang", "expert");
    account(10005, "member_zj", "浙江投稿用户", "member", "zhejiang", "member");
    account(10006, "member_bj", "北京投稿用户", "member", "beijing", "member");
    JfAccess.bootstrapLegacyRoles(store.db());
    initialized = true;
  }

  static final List<String> MIGRATIONS = List.of(
      "V001__domain.sql", "V002__revision_files.sql", "V003__private_records.sql", "V004__search.sql",
      "V005__review_windows.sql", "V006__public_cache.sql", "V007__permissions.sql",
      "V008__review_versions.sql", "V009__education.sql", "V010__jobs.sql", "V011__credentials_resources.sql",
      "V012__regions_consultations.sql", "V013__media_accessibility.sql", "V014__engagement.sql", "V015__ai_tasks.sql");
  static final int VERSION = MIGRATIONS.size();
  // Exact byte-identical AI migration previously used only by the local AI branch as V005.
  static final String LEGACY_AI_CHECKSUM = "485be2de150ead724a2508f6f534b0d92911e3bd8861ffe67bd41a0a6424db13";

  /** All migration metadata and SQL use the same connection that owns the MySQL advisory lock. */
  static void migrate(Connection connection) throws SQLException, IOException {
    require(connection.getAutoCommit(), 500, "MIGRATION_TRANSACTION", "迁移需要独立的自动提交连接");
    try (var lock = connection.prepareStatement("SELECT GET_LOCK('jiafeng-schema-migration',60)");
        var result = lock.executeQuery()) {
      if (!result.next() || result.getInt(1) != 1)
        throw new IllegalStateException("Migration lock unavailable");
    }
    try {
      try (var statement = connection.createStatement()) {
        statement.execute("CREATE TABLE IF NOT EXISTS jf_schema_version(version INT PRIMARY KEY,checksum"
            + " VARCHAR(64) NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
      }
      List<String> digests = new ArrayList<>();
      for (String migration : MIGRATIONS)
        digests.add(hash(new ClassPathResource("db/jiafeng/" + migration).getContentAsString(StandardCharsets.UTF_8)));
      require(LEGACY_AI_CHECKSUM.equals(digests.get(14)), 500, "MIGRATION_CHECKSUM", "AI原始迁移文件被修改");
      var installed = installedVersions(connection, false);
      boolean legacyAi = LEGACY_AI_CHECKSUM.equals(installed.get(5));
      require(!legacyAi || !installed.containsKey(15), 500, "MIGRATION_CONFLICT", "旧AI迁移与V015记录冲突，停止迁移");
      // Validate every recorded migration before applying anything, including before legacy relocation.
      for (var entry : installed.entrySet()) {
        int version = entry.getKey();
        require(version >= 1 && version <= VERSION, 500, "MIGRATION_VERSION", "不支持的迁移版本：" + version);
        require((legacyAi && version == 5) || digests.get(version - 1).equals(entry.getValue()),
            500, "MIGRATION_CHECKSUM", "迁移校验不一致：" + version);
      }
      if (legacyAi) {
        relocateLegacyAi(connection);
        installed.remove(5);
        installed.put(15, LEGACY_AI_CHECKSUM);
      }
      for (int version = 1; version <= VERSION; version++) {
        if (installed.containsKey(version)) continue;
        var resource = new ClassPathResource("db/jiafeng/" + MIGRATIONS.get(version - 1));
        ScriptUtils.executeSqlScript(connection, pendingMigrationResource(connection, version, resource));
        try (var insert = connection.prepareStatement("INSERT INTO jf_schema_version(version,checksum) VALUES(?,?)")) {
          insert.setInt(1, version);
          insert.setString(2, digests.get(version - 1));
          insert.executeUpdate();
        }
      }
    } finally {
      try (var release = connection.createStatement()) {
        release.execute("SELECT RELEASE_LOCK('jiafeng-schema-migration')");
      }
    }
  }

  private static Map<Integer, String> installedVersions(Connection connection, boolean lock)
      throws SQLException {
    var installed = new LinkedHashMap<Integer, String>();
    String sql = "SELECT version,checksum FROM jf_schema_version"
        + (lock ? " WHERE version IN (5,15) FOR UPDATE" : " ORDER BY version");
    try (var query = connection.prepareStatement(sql); var rows = query.executeQuery()) {
      while (rows.next()) installed.put(rows.getInt("version"), rows.getString("checksum"));
    }
    return installed;
  }

  /**
   * Rename only the known historical metadata row, never edit SQL or copy/recreate application data.
   * The primary-key update preserves checksum and applied_at. It commits before any MySQL DDL,
   * so restart sees either old V005 (retry relocation) or V015 (resume the missing upstream versions).
   */
  private static void relocateLegacyAi(Connection connection) throws SQLException {
    connection.setAutoCommit(false);
    try {
      var locked = installedVersions(connection, true);
      require(LEGACY_AI_CHECKSUM.equals(locked.get(5)) && !locked.containsKey(15),
          500, "MIGRATION_CONFLICT", "旧AI迁移记录已变化，停止迁移");
      try (var update = connection.prepareStatement(
          "UPDATE jf_schema_version SET version=15 WHERE version=5 AND checksum=?")) {
        update.setString(1, LEGACY_AI_CHECKSUM);
        require(update.executeUpdate() == 1, 500, "MIGRATION_CONFLICT", "旧AI迁移重定位失败");
      }
      connection.commit();
    } catch (SQLException | RuntimeException failure) {
      try { connection.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
      throw failure;
    } finally {
      connection.setAutoCommit(true);
    }
  }

  /**
   * V008 predates guarded index creation. MySQL DDL can survive an interrupted
   * script before its checksum is recorded. Preserve the original checksum and
   * skip only this exact ALTER when the already-created index is equivalent.
   * Recorded migrations never enter this path; other SQL errors still propagate.
   */
  static Resource pendingMigrationResource(Connection connection, int version, Resource source)
      throws SQLException, IOException {
    if (version != 8) return source;
    List<String> columns = List.of("submission_id", "status", "due_at_ms");
    int count = 0;
    try (var query = connection.prepareStatement(
        "SELECT SEQ_IN_INDEX,COLUMN_NAME,NON_UNIQUE,SUB_PART,INDEX_TYPE,COLLATION,IS_VISIBLE,EXPRESSION "
            + "FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() "
            + "AND TABLE_NAME='jf_review_window' AND INDEX_NAME='jf_review_submission' ORDER BY SEQ_IN_INDEX")) {
      try (var result = query.executeQuery()) {
        while (result.next()) {
          if (count >= columns.size() || result.getInt("SEQ_IN_INDEX") != count + 1
              || !columns.get(count).equals(result.getString("COLUMN_NAME"))
              || result.getInt("NON_UNIQUE") != 1 || result.getObject("SUB_PART") != null
              || !"BTREE".equals(result.getString("INDEX_TYPE"))
              || !"A".equals(result.getString("COLLATION"))
              || !"YES".equals(result.getString("IS_VISIBLE"))
              || result.getObject("EXPRESSION") != null) {
            throw new IllegalStateException("V008 recovery refused: jf_review_submission index definition conflicts with migration");
          }
          count++;
        }
      }
    }
    if (count == 0) return source;
    if (count != columns.size())
      throw new IllegalStateException("V008 recovery refused: jf_review_submission index columns are incomplete");
    String statement = "ALTER TABLE jf_review_window ADD INDEX jf_review_submission (submission_id,status,due_at_ms);";
    String script = source.getContentAsString(StandardCharsets.UTF_8);
    int start = script.indexOf(statement);
    if (start < 0 || start != script.lastIndexOf(statement))
      throw new IllegalStateException("V008 recovery refused: expected exactly one original index statement");
    return new ByteArrayResource(
        script.replace(statement, "-- V008 recovery: the existing index definition has been verified.")
            .getBytes(StandardCharsets.UTF_8),
        source.getDescription() + " (verified V008 interrupted-index recovery)");
  }

  private void seedSetting(String name, Map<String, Object> value) {
    store
        .db()
        .update(
            "INSERT IGNORE INTO jf_entity(id,kind,owner_id,region_id,status,payload) VALUES(?,"
                + " 'setting',NULL,'all','active',?)",
            name,
            json(value));
  }

  private void account(
      long id, String username, String name, String realm, String region, String role) {
    if (!store.db().queryForList("SELECT user_id FROM jf_account WHERE user_id=?", id).isEmpty())
      return;
    store
        .db()
        .update(
            "INSERT INTO"
                + " sys_user(user_id,dept_id,user_name,nick_name,user_type,password,status,del_flag,create_time)"
                + " VALUES(?,100,?,?,?,?,'0','0',NOW())",
            id,
            username,
            name,
            realm.equals("member") ? "app_user" : "sys_user",
            BCrypt.hashpw(password));
    store
        .db()
        .update(
            "INSERT INTO jf_account(user_id,realm,region_ids,roles,profile) VALUES(?,?,?,?,?)",
            id,
            realm,
            json(List.of(region)),
            json(List.of(role)),
            json(m("organization", "开发试点账号", "status", "已通过")));
    if (role.equals("expert"))
      store
          .db()
          .update(
              "INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload)"
                  + " VALUES(?,'expert',?,?,'active',?)",
              Long.toString(id),
              id,
              region,
              json(
                  m(
                      "name",
                      name,
                      "title",
                      "试点评审员",
                      "organization",
                      "家风试点",
                      "group",
                      "文学创作组",
                      "availability",
                      "可分配",
                      "specialties",
                      List.of("家风家书", "家风纪实散文"),
                      "assigned",
                      0,
                      "completed",
                      0,
                      "rating",
                      0,
                      "email",
                      "",
                      "biography",
                      "开发账号，用于验证真实任务权限。")));
  }
}
