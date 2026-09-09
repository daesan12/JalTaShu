package com.s15p21b103.good_tashu.fcm.repository;

import com.s15p21b103.good_tashu.fcm.domain.FcmTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FcmTokenRepository extends JpaRepository<FcmTokenEntity, Long> {
    Optional<FcmTokenEntity> findByToken(String token);

    //Optional<FcmTokenEntity> findByUserIdAndEnabledTrue(Long userId);
}
