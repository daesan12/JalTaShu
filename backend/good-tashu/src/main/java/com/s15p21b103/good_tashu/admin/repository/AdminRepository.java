package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminRepository extends JpaRepository<AdminEntity, Long> {
    // Login ID (String), distinct from JpaRepository.findById(adminId: Long).
    Optional<AdminEntity> findByIdEquals(String id);
}
