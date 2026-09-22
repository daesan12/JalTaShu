package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu._util.jwt.refresh_token.repository.RefreshTokenRepository;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.domain.RefreshTokenRecord;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import java.util.Optional;

/** Separate Redis namespace; reuse the atomic rotation and reuse-detection scripts. */
@Repository
public class AdminRefreshTokenRepository {
    private final RefreshTokenRepository delegate;

    public AdminRefreshTokenRepository(StringRedisTemplate redis, JsonMapper mapper) {
        delegate = new RefreshTokenRepository(redis, mapper, "auth:{admin-refresh-auth}:v1:");
    }

    public void issue(RefreshTokenRecord record) { delegate.issue(record); }
    public Optional<RefreshTokenRecord> findByTokenHash(String hash) { return delegate.findByTokenHash(hash); }
    public Optional<RefreshTokenRecord> findByUserId(Long adminId) { return delegate.findByUserId(adminId); }
    public RefreshTokenRepository.RotationResult rotate(RefreshTokenRecord current, RefreshTokenRecord next) {
        return delegate.rotate(current, next);
    }
    public boolean revokeIfVersionMatches(Long adminId, String version) {
        return delegate.revokeIfVersionMatches(adminId, version);
    }
}
