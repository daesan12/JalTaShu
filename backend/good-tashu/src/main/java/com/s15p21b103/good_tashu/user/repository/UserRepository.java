package com.s15p21b103.good_tashu.user.repository;

import com.s15p21b103.good_tashu.user.domain.SocialLoginProvider;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByProviderAndProviderUserId(
            SocialLoginProvider provider,
            String providerUserId
    );
}
