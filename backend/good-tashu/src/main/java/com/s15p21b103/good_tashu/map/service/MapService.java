package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.client.NaverPlaceClient;
import com.s15p21b103.good_tashu.map.client.dto.NaverPlaceItem;
import com.s15p21b103.good_tashu.map.exception.MapException;
import lombok.RequiredArgsConstructor;
import com.s15p21b103.good_tashu.map.dto.res.PathResponseDto;
import org.springframework.web.util.HtmlUtils;
import java.math.BigDecimal;
import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;
import com.s15p21b103.good_tashu.map.dto.res.PlaceSearchRecentListResponse;
import com.s15p21b103.good_tashu.map.dto.res.PlaceSearchResultListResponse;
import org.springframework.stereotype.Service;
import com.s15p21b103.good_tashu.map.domain.RecentPlaceEntity;
import com.s15p21b103.good_tashu.map.dto.req.RecentPlaceRequest;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import com.s15p21b103.good_tashu.map.repository.RecentPlaceRepository;
import com.s15p21b103.good_tashu.user.exception.UserException;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MapService {
    private final NaverPlaceClient naverPlaceClient;
    private final RecentPlaceRepository recentPlaceRepository;
    private final UserRepository userRepository;
    private final PathService pathService;

    // 최근 선택한 장소 저장
    @Transactional
    public void saveRecentPlace(Long userId, RecentPlaceRequest request) {
        // 로그인한 사용자의 선택 기록으로 저장
        if (userId == null) {
            throw new UserException(NOT_EXISTS_USER);
        }
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        // xPos는 경도, yPos는 위도 (이미 도 단위이므로 재변환하지 않음)
        recentPlaceRepository.save(new RecentPlaceEntity(user, request.title().strip(),
                request.address(), request.roadAddress(), request.xPos(), request.yPos()));
    }
    // 장소 검색
    public List<PlaceSearchResultListResponse> searchPlace(String query) {
        // 검색어가 없거나 공백뿐이면 요청 거절
        if (query == null || query.isBlank()) {
            throw new MapException(SEARCH_QUERY_REQUIRED);
        }
        // 앞뒤 공백 제거 후 네이버 검색 호출, 결과를 응답 DTO 목록으로 변환
        return naverPlaceClient.search(query.strip()).items().stream()
                .map(this::toSearchResult).toList();
    }

    // 네이버 검색 결과 한 건을 응답 DTO로 변환
    private PlaceSearchResultListResponse toSearchResult(NaverPlaceItem item) {
        // 결과 또는 업체명이 누락된 응답 검사
        if (item == null || item.title() == null) {
            throw new MapException(NAVER_RESPONSE_INVALID);
        }
        return new PlaceSearchResultListResponse(
                // 강조 태그 제거 및 HTML 문자 복원 (예: &amp; → &)
                HtmlUtils.htmlUnescape(item.title().replaceAll("<[^>]*>", "")),
                item.address(), item.roadAddress(),
                // mapx는 경도, mapy는 위도
                toCoordinate(item.mapx(), 180), toCoordinate(item.mapy(), 90));
    }

    // 좌표 문자열을 BigDecimal로 변환 및 범위 검증
    private BigDecimal toCoordinate(String raw, int limit) {
        // 숫자 형식이 아닌 좌표 거절
        if (raw == null || !raw.matches("-?\\d+(\\.\\d+)?")) {
            throw new MapException(NAVER_RESPONSE_INVALID);
        }
        try {
            BigDecimal coordinate = new BigDecimal(raw);
            // 범위를 넘는 정수 좌표는 10^7로 나눠 도 단위로 변환
            if (!raw.contains(".") && coordinate.abs().compareTo(BigDecimal.valueOf(limit)) > 0) {
                coordinate = coordinate.movePointLeft(7);
            }
            // 변환 후 경도 ±180, 위도 ±90 범위 검사
            if (coordinate.abs().compareTo(BigDecimal.valueOf(limit)) > 0) {
                throw new MapException(NAVER_RESPONSE_INVALID);
            }
            return coordinate;
        } catch (NumberFormatException e) {
            throw new MapException(NAVER_RESPONSE_INVALID);
        }
    }
    //최근 검색어
    @Transactional(readOnly = true)
    public List<PlaceSearchRecentListResponse> getRecentSearchPlace(Long userId, int limit) {
        if (userId == null) {
            throw new UserException(NOT_EXISTS_USER);
        }
        if (limit < 1) {
            throw new MapException(INVALID_RECENT_PLACE_LIMIT);
        }
        // 해당 사용자 기록만 최신순으로 limit개 조회 (동일 시각이면 ID 내림차순)
        return recentPlaceRepository.findByUser_UserIdOrderByCreatedAtDescRecentPlaceIdDesc(
                        userId, PageRequest.of(0, limit)).stream()
                .map(place -> new PlaceSearchRecentListResponse(place.getRecentPlaceId(),
                        place.getPlace(), place.getAddress(), place.getRoadAddress(),
                        place.getLongitude(), place.getLatitude()))
                .toList();
    }

    //최근검색어 삭제
    @Transactional
    public void deleteRecentSearchPlace(Long userId, Long placeId) {
        long deleted = recentPlaceRepository
                .deleteByRecentPlaceIdAndUser_UserId(placeId, userId);

        if (deleted == 0) {
            throw new MapException(NOT_EXISTS_RECENT_PLACE);
        }
    }

    // 경로 반환
    public PathResponseDto getPath(Long userId, BigDecimal startLat, BigDecimal startLng, BigDecimal endLat, BigDecimal endLng) {
        return pathService.buildResponse(startLat, startLng, endLat, endLng);
    }
}
