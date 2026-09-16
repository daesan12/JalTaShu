package com.s15p21b103.good_tashu._util.jwt.refresh_token.repository;

import com.s15p21b103.good_tashu._util.jwt.refresh_token.domain.RefreshTokenRecord;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class RefreshTokenRepository {
    // 기존 userId-only 토큰과 분리한다. 같은 hash tag로 Lua의 키를 동일 슬롯에 배치한다.
    private static final String PREFIX = "auth:{refresh-auth}:v2:";
    private static final DefaultRedisScript<Long> ISSUE = script("issue");
    private static final DefaultRedisScript<Long> ROTATE = script("rotate");
    private static final DefaultRedisScript<Long> REVOKE = script("revoke");
    private final StringRedisTemplate redisTemplate;
    private final JsonMapper jsonMapper;
    private final String prefix;

    @org.springframework.beans.factory.annotation.Autowired
    public RefreshTokenRepository(StringRedisTemplate redisTemplate, JsonMapper jsonMapper) {
        this(redisTemplate, jsonMapper, PREFIX);
    }

    public RefreshTokenRepository(StringRedisTemplate redisTemplate, JsonMapper jsonMapper, String prefix) {
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.prefix = prefix;
    }

    public enum RotationResult { ROTATED, INVALID, REUSED }

    public void issue(RefreshTokenRecord record) {
        Long result = redisTemplate.execute(ISSUE,
                List.of(userKey(record.userId()), tokenKey(record.tokenHash())),
                jsonMapper.writeValueAsString(record));
        if (!Long.valueOf(1).equals(result)) {
            throw new IllegalStateException("Refresh token 저장 실패: 만료 또는 토큰 충돌");
        }
    }

    // 현재 사용자 기록으로 치환하지 않고 제출된 토큰 자체의 이력을 반환한다.
    public Optional<RefreshTokenRecord> findByTokenHash(String tokenHash) {
        return read(tokenKey(tokenHash)).filter(record -> tokenHash.equals(record.tokenHash()));
    }

    public Optional<RefreshTokenRecord> findByUserId(Long userId) {
        return read(userKey(userId))
                .filter(record -> userId.equals(record.userId()))
                .filter(record -> record.status() == RefreshTokenRecord.Status.ACTIVE)
                .filter(record -> Instant.now().toEpochMilli() < record.expiresAtEpochMilli());
    }

    public RotationResult rotate(RefreshTokenRecord expected, RefreshTokenRecord replacement) {
        Long result = redisTemplate.execute(ROTATE,
                List.of(userKey(expected.userId()), tokenKey(expected.tokenHash()),
                        tokenKey(replacement.tokenHash())),
                jsonMapper.writeValueAsString(replacement), expected.tokenHash());
        if (Long.valueOf(1).equals(result)) return RotationResult.ROTATED;
        if (Long.valueOf(-1).equals(result)) return RotationResult.REUSED;
        if (Long.valueOf(0).equals(result)) return RotationResult.INVALID;
        throw new IllegalStateException("Redis rotation 결과를 확인할 수 없습니다.");
    }

    public boolean revokeIfVersionMatches(Long userId, String expectedAuthVersion) {
        Long result = redisTemplate.execute(REVOKE, List.of(userKey(userId)),
                "authVersion", expectedAuthVersion);
        if (result == null) throw new IllegalStateException("Redis 폐기 결과를 확인할 수 없습니다.");
        return result == 1;
    }

    private Optional<RefreshTokenRecord> read(String key) {
        String json = redisTemplate.opsForValue().get(key);
        return json == null ? Optional.empty()
                : Optional.of(jsonMapper.readValue(json, RefreshTokenRecord.class));
    }

    private String userKey(Long userId) { return prefix + "user:" + userId; }
    private String tokenKey(String tokenHash) { return prefix + "token:" + tokenHash; }

    private static DefaultRedisScript<Long> script(String name) {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setLocation(new ClassPathResource("redis/refresh-token/" + name + ".lua"));
        script.setResultType(Long.class);
        return script;
    }
}
