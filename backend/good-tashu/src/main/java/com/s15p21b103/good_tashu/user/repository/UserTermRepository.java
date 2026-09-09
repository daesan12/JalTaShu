package com.s15p21b103.good_tashu.user.repository;

import com.s15p21b103.good_tashu.user.domain.UserTermEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserTermRepository extends JpaRepository<UserTermEntity, Long> {
    Optional<UserTermEntity> findByUser_UserIdAndTermCode(long userId, String termCode);
}
