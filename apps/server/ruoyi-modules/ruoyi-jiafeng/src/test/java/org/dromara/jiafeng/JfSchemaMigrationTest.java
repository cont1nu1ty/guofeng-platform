package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptStatementFailedException;

/** Stateful JDBC unit fixture: no live server, application container or database is used. */
class JfSchemaMigrationTest {
  private record Applied(String checksum, String appliedAt) {}

  private static String digest(int version) throws Exception {
    return hash(new ClassPathResource("db/jiafeng/" + JfSchema.MIGRATIONS.get(version - 1))
        .getContentAsString(StandardCharsets.UTF_8));
  }

  private static class Database {
    final Connection connection = mock(Connection.class);
    final Map<Integer, Applied> versions = new TreeMap<>();
    final List<Integer> inserted = new ArrayList<>();
    final List<String> statements = new ArrayList<>();
    Map<Integer, Applied> beforeTransaction;
    boolean autoCommit = true, locked, lockAvailable = true, failCommit, failMove;
    int moves, failInsert;
    String failSql = "";

    Database() throws SQLException {
      when(connection.getAutoCommit()).thenAnswer(call -> autoCommit);
      doAnswer(call -> {
        boolean next = call.getArgument(0);
        assertTrue(locked, "Metadata transaction must own the migration lock");
        if (!next) beforeTransaction = new TreeMap<>(versions);
        autoCommit = next;
        return null;
      }).when(connection).setAutoCommit(anyBoolean());
      doAnswer(call -> {
        assertFalse(autoCommit);
        if (failCommit) throw new SQLException("Injected commit interruption");
        beforeTransaction = null;
        return null;
      }).when(connection).commit();
      doAnswer(call -> {
        if (beforeTransaction != null) { versions.clear(); versions.putAll(beforeTransaction); }
        beforeTransaction = null;
        return null;
      }).when(connection).rollback();
      when(connection.prepareStatement(anyString())).thenAnswer(call -> prepared(call.getArgument(0)));
      when(connection.createStatement()).thenAnswer(call -> {
        var statement = mock(Statement.class);
        when(statement.getUpdateCount()).thenReturn(-1);
        when(statement.execute(anyString())).thenAnswer(execution -> {
          String sql = execution.getArgument(0);
          assertTrue(locked, "All schema statements must own the migration lock");
          assertTrue(autoCommit, "MySQL DDL must never run inside the metadata relocation transaction");
          statements.add(sql);
          if (sql.startsWith("SELECT RELEASE_LOCK")) locked = false;
          if (!failSql.isBlank() && sql.contains(failSql)) throw new SQLException("Injected DDL interruption");
          return false;
        });
        return statement;
      });
    }

    void installedThrough(int version) throws Exception {
      for (int v = 1; v <= version; v++) versions.put(v, new Applied(digest(v), "original-" + v));
    }

    void legacy() throws Exception {
      installedThrough(4);
      versions.put(5, new Applied(JfSchema.LEGACY_AI_CHECKSUM, "2026-10-13 08:12:34"));
    }

    private PreparedStatement prepared(String sql) throws SQLException {
      var statement = mock(PreparedStatement.class);
      var args = new HashMap<Integer, Object>();
      doAnswer(call -> { args.put(call.getArgument(0), call.getArgument(1)); return null; })
          .when(statement).setInt(anyInt(), anyInt());
      doAnswer(call -> { args.put(call.getArgument(0), call.getArgument(1)); return null; })
          .when(statement).setString(anyInt(), anyString());
      when(statement.executeQuery()).thenAnswer(call -> {
        if (sql.startsWith("SELECT GET_LOCK")) {
          locked = lockAvailable;
          var result = mock(ResultSet.class);
          when(result.next()).thenReturn(true, false);
          when(result.getInt(1)).thenReturn(lockAvailable ? 1 : 0);
          return result;
        }
        assertTrue(locked);
        if (sql.contains("information_schema.statistics")) return rows(Map.of());
        assertTrue(sql.startsWith("SELECT version,checksum FROM jf_schema_version"), sql);
        if (sql.contains("FOR UPDATE")) assertFalse(autoCommit);
        return rows(versions);
      });
      when(statement.executeUpdate()).thenAnswer(call -> {
        assertTrue(locked);
        if (sql.startsWith("UPDATE jf_schema_version SET version=15")) {
          assertFalse(autoCommit);
          assertEquals(JfSchema.LEGACY_AI_CHECKSUM, args.get(1));
          if (failMove) throw new SQLException("Injected relocation interruption");
          assertFalse(versions.containsKey(15));
          versions.put(15, versions.remove(5));
          moves++;
          return 1;
        }
        assertEquals("INSERT INTO jf_schema_version(version,checksum) VALUES(?,?)", sql);
        assertTrue(autoCommit);
        int version = (int) args.get(1);
        if (failInsert == version) throw new SQLException("Injected checksum recording interruption");
        assertFalse(versions.containsKey(version), "Existing migration must not be rerun");
        versions.put(version, new Applied((String) args.get(2), "new-" + version));
        inserted.add(version);
        return 1;
      });
      return statement;
    }

    private ResultSet rows(Map<Integer, Applied> source) throws SQLException {
      var snapshot = new ArrayList<>(source.entrySet());
      var position = new AtomicInteger(-1);
      var result = mock(ResultSet.class);
      when(result.next()).thenAnswer(call -> position.incrementAndGet() < snapshot.size());
      when(result.getInt("version")).thenAnswer(call -> snapshot.get(position.get()).getKey());
      when(result.getString("checksum")).thenAnswer(call -> snapshot.get(position.get()).getValue().checksum());
      return result;
    }

    long aiDdlCount() { return statements.stream().filter(s -> s.startsWith("CREATE TABLE IF NOT EXISTS jf_ai_")).count(); }
  }

  @Test void newDatabaseAppliesAllFifteenVersionsInOrderAndRestartDoesNothing() throws Exception {
    var db = new Database();
    JfSchema.migrate(db.connection);
    assertEquals(java.util.stream.IntStream.rangeClosed(1, 15).boxed().toList(), db.inserted);
    assertEquals(2, db.aiDdlCount());
    assertEquals(JfSchema.LEGACY_AI_CHECKSUM, digest(15), "Renumbering must preserve original AI SQL bytes");
    var saved = new TreeMap<>(db.versions);
    db.inserted.clear(); db.statements.clear();
    JfSchema.migrate(db.connection);
    assertTrue(db.inserted.isEmpty()); assertEquals(saved, db.versions);
    assertEquals(2, db.statements.size(), "Only metadata CREATE and lock release run on restart");
    verify(db.connection, never()).setAutoCommit(false);
  }

  @Test void upstreamV14AppliesOnlyAiV15() throws Exception {
    var db = new Database(); db.installedThrough(14);
    var original = new TreeMap<>(db.versions);
    JfSchema.migrate(db.connection);
    assertEquals(List.of(15), db.inserted);
    original.forEach((v, row) -> assertEquals(row, db.versions.get(v)));
    assertEquals(2, db.aiDdlCount()); assertEquals(0, db.moves);
  }

  @Test void legacyAiV5MovesAtomicallyPreservingTimestampThenAppliesUpstreamFiveThroughFourteen() throws Exception {
    var db = new Database(); db.legacy();
    var aiApplied = db.versions.get(5);
    JfSchema.migrate(db.connection);
    assertEquals(aiApplied, db.versions.get(15));
    assertEquals(java.util.stream.IntStream.rangeClosed(5, 14).boxed().toList(), db.inserted);
    assertEquals(digest(5), db.versions.get(5).checksum());
    assertEquals(0, db.aiDdlCount(), "Existing AI tables and their data are never recreated");
    var order = inOrder(db.connection);
    order.verify(db.connection).setAutoCommit(false);
    order.verify(db.connection).commit();
    order.verify(db.connection).setAutoCommit(true);
    verify(db.connection, never()).rollback();
    assertFalse(db.locked);
  }

  @Test void unknownChecksumsFailBeforeAnyDomainDdlOrMetadataChange() throws Exception {
    for (int corrupted : List.of(1, 5, 10, 15)) {
      var db = new Database(); db.installedThrough(15);
      db.versions.put(corrupted, new Applied("unknown-checksum", "original"));
      var original = new TreeMap<>(db.versions);
      var failure = assertThrows(ApiException.class, () -> JfSchema.migrate(db.connection));
      assertEquals("MIGRATION_CHECKSUM", failure.code);
      assertEquals(original, db.versions); assertTrue(db.inserted.isEmpty());
      assertEquals(0, db.moves); assertEquals(2, db.statements.size()); assertFalse(db.locked);
    }
  }

  @Test void legacyAiAndAnyExistingV15RefuseToGuessEvenWhenChecksumsMatch() throws Exception {
    for (String checksum : List.of(JfSchema.LEGACY_AI_CHECKSUM, "conflicting-checksum")) {
      var db = new Database(); db.legacy();
      db.versions.put(15, new Applied(checksum, "different-timestamp"));
      var original = new TreeMap<>(db.versions);
      assertEquals("MIGRATION_CONFLICT", assertThrows(ApiException.class,
          () -> JfSchema.migrate(db.connection)).code);
      assertEquals(original, db.versions); assertEquals(0, db.moves);
      verify(db.connection, never()).setAutoCommit(false);
    }
  }

  @Test void legacyRelocationDoesNotMaskAnUnrelatedChecksumMismatch() throws Exception {
    var db = new Database(); db.legacy();
    db.versions.put(2, new Applied("wrong", "original-2"));
    assertEquals("MIGRATION_CHECKSUM", assertThrows(ApiException.class,
        () -> JfSchema.migrate(db.connection)).code);
    assertFalse(db.versions.containsKey(15)); assertEquals(0, db.moves);
  }

  @Test void failedMoveOrCommitRollsBackThenRetryPreservesOriginalAiTimestamp() throws Exception {
    for (boolean commitFailure : List.of(false, true)) {
      var db = new Database(); db.legacy();
      var original = new TreeMap<>(db.versions);
      db.failCommit = commitFailure; db.failMove = !commitFailure;
      assertThrows(SQLException.class, () -> JfSchema.migrate(db.connection));
      assertEquals(original, db.versions); assertTrue(db.inserted.isEmpty());
      verify(db.connection).rollback(); assertTrue(db.autoCommit); assertFalse(db.locked);
      db.failCommit = false; db.failMove = false;
      JfSchema.migrate(db.connection);
      assertEquals(original.get(5), db.versions.get(15)); assertEquals(15, db.versions.size());
    }
  }

  @Test void interruptionAfterCommittedRelocationResumesMissingUpstreamMigrationsWithoutReapplyingAi() throws Exception {
    var db = new Database(); db.legacy();
    var originalAi = db.versions.get(5);
    db.failSql = "CREATE TABLE IF NOT EXISTS jf_review_window";
    assertThrows(ScriptStatementFailedException.class, () -> JfSchema.migrate(db.connection));
    assertEquals(originalAi, db.versions.get(15)); assertFalse(db.versions.containsKey(5));
    assertFalse(db.locked);
    db.failSql = "";
    JfSchema.migrate(db.connection);
    assertEquals(1, db.moves); assertEquals(15, db.versions.size());
    assertEquals(0, db.aiDdlCount()); assertEquals(originalAi, db.versions.get(15));
  }

  @Test void interruptedAiChecksumRecordingCanRepeatGuardedDdlAndThenBecomesIdempotent() throws Exception {
    var db = new Database(); db.installedThrough(14); db.failInsert = 15;
    assertThrows(SQLException.class, () -> JfSchema.migrate(db.connection));
    assertFalse(db.versions.containsKey(15)); assertEquals(2, db.aiDdlCount());
    db.failInsert = 0;
    JfSchema.migrate(db.connection);
    assertEquals(List.of(15), db.inserted); assertEquals(4, db.aiDdlCount());
    JfSchema.migrate(db.connection);
    assertEquals(4, db.aiDdlCount()); assertEquals(15, db.versions.size());
  }

  @Test void unavailableLockAndUnsupportedNewerSchemaNeverMutateHistory() throws Exception {
    var db = new Database(); db.legacy(); db.lockAvailable = false;
    assertThrows(IllegalStateException.class, () -> JfSchema.migrate(db.connection));
    assertTrue(db.statements.isEmpty()); assertTrue(db.inserted.isEmpty());
    db.lockAvailable = true;
    db.versions.put(16, new Applied("future", "original"));
    assertEquals("MIGRATION_VERSION", assertThrows(ApiException.class,
        () -> JfSchema.migrate(db.connection)).code);
    assertFalse(db.versions.containsKey(15));
  }
}
