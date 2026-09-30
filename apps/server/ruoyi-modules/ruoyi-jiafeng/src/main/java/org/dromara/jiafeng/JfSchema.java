package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import cn.hutool.crypto.digest.BCrypt;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
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
    store
        .db()
        .execute(
            "CREATE TABLE IF NOT EXISTS jf_schema_version(version INT PRIMARY KEY,checksum"
                + " VARCHAR(64) NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    try (Connection connection = dataSource.getConnection()) {
      try (var lock =
          connection.prepareStatement("SELECT GET_LOCK('jiafeng-schema-migration',60)")) {
        var result = lock.executeQuery();
        result.next();
        if (result.getInt(1) != 1) throw new IllegalStateException("Migration lock unavailable");
      }
      try {
        String[] migrations = {
          "V001__domain.sql", "V002__revision_files.sql", "V003__private_records.sql", "V004__search.sql",
          "V005__review_windows.sql", "V006__public_cache.sql"
        };
        for (int i = 0; i < migrations.length; i++) {
          int version = i + 1;
          var resource = new ClassPathResource("db/jiafeng/" + migrations[i]);
          String digest = hash(resource.getContentAsString(StandardCharsets.UTF_8));
          var rows =
              store
                  .db()
                  .queryForList("SELECT checksum FROM jf_schema_version WHERE version=?", version);
          if (rows.isEmpty()) {
            ScriptUtils.executeSqlScript(connection, resource);
            store
                .db()
                .update(
                    "INSERT INTO jf_schema_version(version,checksum) VALUES(?,?)", version, digest);
          } else
            require(
                digest.equals(rows.getFirst().get("checksum")),
                500,
                "MIGRATION_CHECKSUM",
                "迁移校验不一致：" + version);
        }
      } finally {
        connection.createStatement().execute("SELECT RELEASE_LOCK('jiafeng-schema-migration')");
      }
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
    initialized = true;
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
