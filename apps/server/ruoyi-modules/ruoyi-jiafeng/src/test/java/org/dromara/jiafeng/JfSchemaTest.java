package org.dromara.jiafeng;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptStatementFailedException;
import org.springframework.jdbc.datasource.init.ScriptUtils;

class JfSchemaTest {
  private static final List<String> COLUMNS = List.of("submission_id", "status", "due_at_ms");
  private static final String ALTER =
      "ALTER TABLE jf_review_window ADD INDEX jf_review_submission (submission_id,status,due_at_ms);";

  private record Metadata(Connection connection, ResultSet result) {}

  private Metadata metadata(List<String> columns) throws SQLException {
    var connection = mock(Connection.class);
    var query = mock(PreparedStatement.class);
    var result = mock(ResultSet.class);
    when(connection.prepareStatement(contains("information_schema.statistics"))).thenReturn(query);
    when(query.executeQuery()).thenReturn(result);
    var row = new AtomicInteger(-1);
    when(result.next()).thenAnswer(call -> row.incrementAndGet() < columns.size());
    when(result.getInt("SEQ_IN_INDEX")).thenAnswer(call -> row.get() + 1);
    when(result.getString("COLUMN_NAME")).thenAnswer(call -> columns.get(row.get()));
    when(result.getInt("NON_UNIQUE")).thenReturn(1);
    when(result.getString("INDEX_TYPE")).thenReturn("BTREE");
    when(result.getString("COLLATION")).thenReturn("A");
    when(result.getString("IS_VISIBLE")).thenReturn("YES");
    return new Metadata(connection, result);
  }

  private ClassPathResource original() {
    return new ClassPathResource("db/jiafeng/V008__review_versions.sql");
  }

  @Test void missingIndexRunsTheOriginalMigrationUnchanged() throws Exception {
    var db = metadata(List.of());
    var source = original();
    assertSame(source, JfSchema.pendingMigrationResource(db.connection(), 8, source));
    assertTrue(source.getContentAsString(StandardCharsets.UTF_8).contains(ALTER));
  }

  @Test void matchingIndexSkipsOnlyTheAlterAndExecutesBothRemainingTables() throws Exception {
    var db = metadata(COLUMNS);
    var source = original();
    byte[] originalBytes = source.getContentAsByteArray();
    var executable = JfSchema.pendingMigrationResource(db.connection(), 8, source);
    assertArrayEquals(originalBytes, source.getContentAsByteArray(), "Checksum source must stay unchanged");
    assertFalse(executable.getContentAsString(StandardCharsets.UTF_8).contains(ALTER));
    var statement = mock(Statement.class);
    when(statement.getUpdateCount()).thenReturn(-1);
    when(db.connection().createStatement()).thenReturn(statement);
    ScriptUtils.executeSqlScript(db.connection(), executable);
    verify(statement).execute(startsWith("CREATE TABLE IF NOT EXISTS jf_review_binding"));
    verify(statement).execute(startsWith("CREATE TABLE IF NOT EXISTS jf_submission_import"));
    verify(statement, times(2)).execute(anyString());
    verify(statement, never()).execute(contains("ADD INDEX"));
  }

  @Test void wrongOrderOrMissingOrAdditionalColumnsRefuseRecovery() throws Exception {
    for (var columns : List.of(
        List.of("status", "submission_id", "due_at_ms"),
        List.of("submission_id", "status"),
        List.of("submission_id", "status", "due_at_ms", "revision_id"))) {
      var db = metadata(columns);
      assertThrows(IllegalStateException.class,
          () -> JfSchema.pendingMigrationResource(db.connection(), 8, original()));
      verify(db.connection(), never()).createStatement();
    }
  }

  @Test void uniqueOrPrefixOrDescendingOrInvisibleIndexesRefuseRecovery() throws Exception {
    for (String conflict : List.of("unique", "prefix", "descending", "invisible", "expression", "type")) {
      var db = metadata(COLUMNS);
      switch (conflict) {
        case "unique" -> when(db.result().getInt("NON_UNIQUE")).thenReturn(0);
        case "prefix" -> when(db.result().getObject("SUB_PART")).thenReturn(10L);
        case "descending" -> when(db.result().getString("COLLATION")).thenReturn("D");
        case "invisible" -> when(db.result().getString("IS_VISIBLE")).thenReturn("NO");
        case "expression" -> when(db.result().getObject("EXPRESSION")).thenReturn("lower(status)");
        case "type" -> when(db.result().getString("INDEX_TYPE")).thenReturn("HASH");
        default -> fail("Unhandled fixture");
      }
      assertThrows(IllegalStateException.class,
          () -> JfSchema.pendingMigrationResource(db.connection(), 8, original()), conflict);
      verify(db.connection(), never()).createStatement();
    }
  }

  @Test void otherMigrationVersionsNeverInspectOrChangeTheirResource() throws Exception {
    var connection = mock(Connection.class);
    var source = original();
    for (int version : List.of(1, 7, 9, 10, 14))
      assertSame(source, JfSchema.pendingMigrationResource(connection, version, source));
    verifyNoInteractions(connection);
  }

  @Test void metadataErrorsAndUnrelatedSqlFailuresStillPropagate() throws Exception {
    var connection = mock(Connection.class);
    when(connection.prepareStatement(anyString())).thenThrow(new SQLException("Metadata read unavailable"));
    assertThrows(SQLException.class, () -> JfSchema.pendingMigrationResource(connection, 8, original()));

    var db = metadata(COLUMNS);
    var executable = JfSchema.pendingMigrationResource(db.connection(), 8, original());
    var statement = mock(Statement.class);
    when(statement.getUpdateCount()).thenReturn(-1);
    when(db.connection().createStatement()).thenReturn(statement);
    when(statement.execute(startsWith("CREATE TABLE IF NOT EXISTS jf_submission_import")))
        .thenThrow(new SQLException("Unrelated DDL failure"));
    assertThrows(ScriptStatementFailedException.class,
        () -> ScriptUtils.executeSqlScript(db.connection(), executable));
  }
}
