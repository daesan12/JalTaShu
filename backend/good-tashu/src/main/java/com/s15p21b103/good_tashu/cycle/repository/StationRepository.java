package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StationRepository extends JpaRepository<StationEntity, String> {
}
