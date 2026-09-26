package org.dromara.jiafeng;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.dromara.common.json.utils.JsonUtils;

/** Boundary helpers; never accepts ownership or authorization from payloads. */
public final class Jf {
  private Jf() {}

  public static final List<String> REGION_IDS =
      List.of(
          "beijing",
          "tianjin",
          "hebei",
          "shanxi",
          "inner-mongolia",
          "liaoning",
          "jilin",
          "heilongjiang",
          "shanghai",
          "jiangsu",
          "zhejiang",
          "anhui",
          "fujian",
          "jiangxi",
          "shandong",
          "henan",
          "hubei",
          "hunan",
          "guangdong",
          "guangxi",
          "hainan",
          "chongqing",
          "sichuan",
          "guizhou",
          "yunnan",
          "xizang",
          "shaanxi",
          "gansu",
          "qinghai",
          "ningxia",
          "xinjiang",
          "hong-kong",
          "macao",
          "taiwan",
          "overseas");
  private static final List<String> REGION_NAMES =
      List.of(
          "北京市",
          "天津市",
          "河北省",
          "山西省",
          "内蒙古自治区",
          "辽宁省",
          "吉林省",
          "黑龙江省",
          "上海市",
          "江苏省",
          "浙江省",
          "安徽省",
          "福建省",
          "江西省",
          "山东省",
          "河南省",
          "湖北省",
          "湖南省",
          "广东省",
          "广西壮族自治区",
          "海南省",
          "重庆市",
          "四川省",
          "贵州省",
          "云南省",
          "西藏自治区",
          "陕西省",
          "甘肃省",
          "青海省",
          "宁夏回族自治区",
          "新疆维吾尔自治区",
          "香港特别行政区",
          "澳门特别行政区",
          "台湾省",
          "海外");
  public static final List<String> STAGES =
      List.of("区县初审", "市级行业复审", "文史专家评审", "专项终审", "国家级复核", "全国标准审定");
  public static final List<Map<String, Object>> DIMENSIONS =
      List.of(
          m("id", "value", "label", "思想与价值", "min", 0, "max", 30),
          m("id", "expression", "label", "内容与表达", "min", 0, "max", 30),
          m("id", "culture", "label", "文化与传承", "min", 0, "max", 25),
          m("id", "originality", "label", "原创与特色", "min", 0, "max", 15));

  public static Map<String, Object> m(Object... entries) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (int i = 0; i < entries.length; i += 2) result.put(entries[i].toString(), entries[i + 1]);
    return result;
  }

  @SuppressWarnings("unchecked")
  public static Map<String, Object> obj(Object value) {
    return value instanceof Map ? (Map<String, Object>) value : new LinkedHashMap<>();
  }

  @SuppressWarnings("unchecked")
  public static List<Object> list(Object value) {
    return value instanceof List ? (List<Object>) value : new ArrayList<>();
  }

  public static String text(Object value) {
    return value == null ? "" : value.toString();
  }

  public static String str(Map<String, Object> value, String key) {
    return text(value.get(key));
  }

  public static boolean bool(Object value) {
    return Boolean.TRUE.equals(value) || "true".equals(text(value));
  }

  public static long number(Object value) {
    try {
      return Long.parseLong(text(value));
    } catch (Exception e) {
      throw error(422, "VALIDATION_FAILED", "请输入整数");
    }
  }

  public static String id(String prefix) {
    return prefix + UUID.randomUUID().toString().replace("-", "");
  }

  public static String timestamp(Object value) {
    if (value instanceof java.sql.Timestamp t) return t.toInstant().toString();
    if (value instanceof java.time.LocalDateTime t)
      return t.atZone(java.time.ZoneId.of("Asia/Shanghai")).toInstant().toString();
    return text(value);
  }

  public static String now() {
    return Instant.now().toString();
  }

  public static String json(Object value) {
    return JsonUtils.toJsonString(value);
  }

  public static Map<String, Object> parse(String value) {
    return obj(JsonUtils.parseObject(value, Map.class));
  }

  public static Map<String, Object> copy(Map<String, Object> value) {
    return parse(json(value));
  }

  public static String hash(String value) {
    return hash(value.getBytes(StandardCharsets.UTF_8));
  }

  public static String hash(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static String region(Object value) {
    String s = text(value);
    if (s.equals("全国") || s.equals("all")) return "all";
    int i = REGION_NAMES.indexOf(s);
    if (i >= 0) return REGION_IDS.get(i);
    if (REGION_IDS.contains(s)) return s;
    throw error(422, "INVALID_REGION", "请选择有效地区");
  }

  public static String regionName(String id) {
    int i = REGION_IDS.indexOf(id);
    return i < 0 ? "全国" : REGION_NAMES.get(i);
  }

  public static String required(Map<String, Object> data, String key, int min, int max) {
    String s = str(data, key).trim();
    int n = s.codePointCount(0, s.length());
    require(n >= min && n <= max, 422, "VALIDATION_FAILED", key + " 长度应为 " + min + "–" + max);
    return s;
  }

  public static void require(boolean condition, int status, String code, String message) {
    if (!condition) throw error(status, code, message);
  }

  public static ApiException error(int status, String code, String message) {
    return new ApiException(status, code, message);
  }

  public static final class ApiException extends RuntimeException {
    public final int status;
    public final String code;

    public ApiException(int status, String code, String message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
}
