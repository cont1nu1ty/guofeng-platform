package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class JfMember {
  private final JfStore store;
  private final JfAuth auth;
  private final JfProjection projection;
  private final JfReview review;

  public JfMember(JfStore s, JfAuth a, JfProjection p, JfReview r) {
    store = s;
    auth = a;
    projection = p;
    review = r;
  }

  public Object command(
      JfAuth.Actor a, String cmd, String id, Object version, Map<String, Object> data) {
    switch (cmd) {
      case "review.submit" -> {
        return review.command(a, "submitReview", id, version, data);
      }
      case "activity.register", "activity.cancel", "activity.checkIn" -> {
        var e = store.find("activity", id, true);
        require(!e.status().equals("草稿"), 404, "NOT_FOUND", "活动不可见");
        var rows =
            store
                .db()
                .queryForList(
                    "SELECT * FROM jf_registration WHERE activity_id=? AND user_id=? FOR UPDATE",
                    id,
                    a.id);
        if (cmd.equals("activity.register")) {
          require(
              e.status().equals("报名中")
                  && JfOperations.date(str(e.data(), "endAt")).isAfter(java.time.Instant.now()),
              409,
              "REGISTRATION_CLOSED",
              "活动报名已关闭");
          if (!rows.isEmpty() && text(rows.getFirst().get("status")).equals("registered"))
            return ok();
          long count =
              store
                  .db()
                  .queryForObject(
                      "SELECT COUNT(*) FROM jf_registration WHERE activity_id=? AND"
                          + " status='registered'",
                      Long.class,
                      id);
          require(count < number(e.data().get("capacity")), 409, "ACTIVITY_FULL", "活动名额已满");
          if (rows.isEmpty())
            store
                .db()
                .update(
                    "INSERT INTO jf_registration(id,activity_id,user_id,status)"
                        + " VALUES(?,?,?,'registered')",
                    id("reg_"),
                    id,
                    a.id);
          else
            store
                .db()
                .update(
                    "UPDATE jf_registration SET status='registered',checked_in=0,version=version+1"
                        + " WHERE activity_id=? AND user_id=?",
                    id,
                    a.id);
        } else {
          require(
              !rows.isEmpty() && text(rows.getFirst().get("status")).equals("registered"),
              404,
              "NOT_REGISTERED",
              "没有有效报名记录");
          if (cmd.equals("activity.cancel")) {
            require(e.status().equals("报名中"), 409, "CANCELLATION_CLOSED", "活动开始后不能取消报名");
            store
                .db()
                .update(
                    "UPDATE jf_registration SET status='cancelled',checked_in=0,version=version+1"
                        + " WHERE activity_id=? AND user_id=?",
                    id,
                    a.id);
          } else {
            require(e.status().equals("进行中"), 409, "CHECKIN_CLOSED", "活动尚未开始或已经结束");
            store
                .db()
                .update(
                    "UPDATE jf_registration SET checked_in=1,version=version+1 WHERE activity_id=?"
                        + " AND user_id=?",
                    id,
                    a.id);
          }
        }
        if (cmd.equals("activity.checkIn")) store.recordCheckIn(id, a.id, e.region(), true);
        if (cmd.equals("activity.cancel")) store.recordCheckIn(id, a.id, e.region(), false);
        store.save(e, e.region(), e.status(), e.data());
        return ok();
      }
      case "notification.read" -> {
        var e = store.find("notification", id, true);
        require(Objects.equals(e.owner(), a.id), 404, "NOT_FOUND", "消息不存在");
        store.save(e, e.region(), "read", e.data());
        return ok();
      }
      case "favorite.toggle", "media.favorite", "media.like" -> {
        String kind =
            cmd.equals("favorite.toggle")
                ? "favorite"
                : cmd.equals("media.favorite") ? "mediaFavorite" : "mediaLike";
        if (kind.equals("favorite")) {
          boolean visible =
              store.all("submission").stream()
                      .anyMatch(
                          e ->
                              e.id().equals(id)
                                  && (JfSubmissions.isPublic(e) || Objects.equals(e.owner(), a.id)))
                  || store.all("collection").stream()
                      .anyMatch(e -> e.id().equals(id) && e.status().equals("已入藏"));
          require(visible, 404, "NOT_FOUND", "内容不存在或不可见");
        } else {
          var media = store.find("media", id, true);
          require(media.status().equals("已发布"), 404, "NOT_FOUND", "媒体不存在或未发布");
        }
        require(!id.isBlank() && id.length() <= 64, 422, "INVALID_ID", "内容编号无效");
        var existing =
            store.all(kind).stream()
                .filter(
                    e -> Objects.equals(e.owner(), a.id) && str(e.data(), "contentId").equals(id))
                .findFirst();
        if (existing.isPresent())
          store.db().update("DELETE FROM jf_entity WHERE id=?", existing.get().id());
        else
          store.create(
              kind,
              a.id,
              a.regions.stream().findFirst().orElse("all"),
              "active",
              m("contentId", id));
        return ok();
      }
      case "course.progress" -> {
        var e = store.find("course", id, true);
        require(e.status().equals("已上架"), 404, "NOT_FOUND", "课程不存在");
        var record =
            store.all("learning").stream()
                .filter(
                    x -> Objects.equals(x.owner(), a.id) && str(x.data(), "courseId").equals(id))
                .findFirst();
        var d =
            record.isEmpty()
                ? m("courseId", id, "lessons", new ArrayList<>(), "quizPassed", false)
                : copy(record.get().data());
        List<Object> lessons = new ArrayList<>(list(d.get("lessons")));
        String lesson = str(data, "lessonId");
        if (!lesson.isEmpty()) {
          require(
              list(e.data().get("lessons")).stream()
                  .anyMatch(x -> str(obj(x), "id").equals(lesson)),
              422,
              "INVALID_LESSON",
              "课程章节不存在");
          if (!lessons.contains(lesson)) lessons.add(lesson);
        }
        if (data.containsKey("answer")) {
          Map<String, Object> quiz = obj(e.data().get("quiz"));
          require(!quiz.isEmpty(), 409, "QUIZ_NOT_PUBLISHED", "课程尚未发布测验");
          d.put("quizPassed", number(data.get("answer")) == number(quiz.get("answer")));
        }
        d.put("lessons", lessons);
        boolean completed =
            !list(e.data().get("lessons")).isEmpty()
                && lessons.size() == list(e.data().get("lessons")).size()
                && (obj(e.data().get("quiz")).isEmpty() || bool(d.get("quizPassed")));
        if (completed) d.put("completedAt", now());
        String r = a.regions.stream().findFirst().orElse("all");
        if (record.isEmpty())
          store.create("learning", a.id, r, completed ? "completed" : "learning", d);
        else store.save(record.get(), r, completed ? "completed" : "learning", d);
        return ok();
      }
      case "welfare.claim" -> {
        var product = store.find("product", id, true);
        require(product.status().equals("已上架"), 404, "NOT_FOUND", "产品不存在");
        long qty = number(data.get("quantity"));
        require(
            qty > 0 && qty <= number(product.data().get("quota")),
            422,
            "QUOTA_EXCEEDED",
            "数量超出单次额度");
        String kind = str(data, "kind");
        require(List.of("public", "custom").contains(kind), 422, "INVALID_KIND", "申请类型无效");
        String r = product.region();
        var claim =
            store.create(
                "claim",
                a.id,
                r,
                "待审核",
                m(
                    "productId",
                    id,
                    "kind",
                    kind,
                    "organization",
                    required(data, "organization", 2, 150),
                    "quantity",
                    qty,
                    "purpose",
                    required(data, "purpose", 5, 2000),
                    "note",
                    ""));
        return projection.claim(claim);
      }
      case "welfare.cancel" -> {
        var e = store.find("claim", id, true);
        require(Objects.equals(e.owner(), a.id), 404, "NOT_FOUND", "申领记录不存在");
        require(e.status().equals("待审核"), 409, "INVALID_STATE", "已处理的申领不能取消");
        store.save(e, e.region(), "已取消", e.data());
        return ok();
      }
      case "archive.excerpt.save", "archive.ai.save" -> {
        String kind = cmd.contains("excerpt") ? "excerpt" : "archive";
        var clean = copy(data);
        for (String key :
            List.of("id", "ownerId", "userId", "region", "regionId", "status", "isDemo"))
          clean.remove(key);
        require(json(clean).length() <= 50000, 422, "ARCHIVE_TOO_LARGE", "存档内容过长");
        clean.put("createdAt", now());
        var e =
            store.create(kind, a.id, a.regions.stream().findFirst().orElse("all"), "active", clean);
        var result = copy(clean);
        result.put("id", e.id());
        return result;
      }
      case "archive.excerpt.remove", "archive.ai.remove" -> {
        String kind = cmd.contains("excerpt") ? "excerpt" : "archive";
        var e = store.find(kind, id, true);
        require(Objects.equals(e.owner(), a.id), 404, "NOT_FOUND", "存档不存在");
        store.db().update("DELETE FROM jf_entity WHERE id=?", id);
        return ok();
      }
      default -> throw error(422, "UNKNOWN_COMMAND", "暂不支持此操作");
    }
  }

  private Map<String, Object> ok() {
    return m("ok", true, "message", "操作已保存");
  }
}
