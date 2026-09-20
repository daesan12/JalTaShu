package com.s15p21b103.good_tashu.map.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.map.domain.RouteType;
import com.s15p21b103.good_tashu.map.domain.TravelStatus;
import com.s15p21b103.good_tashu.map.dto.res.PathResponseDto;
import com.s15p21b103.good_tashu.map.dto.res.PlaceSearchRecentListResponse;
import com.s15p21b103.good_tashu.map.dto.res.PlaceSearchResultListResponse;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationListItem;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationDetailResponse;
import com.s15p21b103.good_tashu.map.dto.res.WeatherResponse;
import com.s15p21b103.good_tashu.map.service.MapService;
import com.s15p21b103.good_tashu.map.service.BikeStationService;
import com.s15p21b103.good_tashu.map.service.WeatherService;
import com.s15p21b103.good_tashu.map.dto.req.RecentPlaceRequest;
import jakarta.validation.Valid;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/map")
public class MapController {
    private final MapService mapService;
    private final BikeStationService bikeStationService;
    private final WeatherService weatherService;

    @GetMapping("/bike-station")
    public ApiResponse<List<BikeStationListItem>> getBikeStations() {
        return ApiResponse.success(bikeStationService.list());
    }

    @GetMapping("/bike-station/{stationId}")
    public ApiResponse<BikeStationDetailResponse> getBikeStation(@PathVariable String stationId) {
        return ApiResponse.success(bikeStationService.detail(stationId));
    }

    @GetMapping("/weather")
    public ApiResponse<WeatherResponse> getWeather() {
        return ApiResponse.success(weatherService.getLatest());
    }

    // 최근 선택한 장소 최근 검색어에 등록
    @PostMapping("/location/recent")
    public ApiResponse<Void> saveRecentPlace(@CurrentUserId Long userId,
                                            @Valid @RequestBody RecentPlaceRequest request) {
        mapService.saveRecentPlace(userId, request);
        return ApiResponse.success("최근 검색한 장소가 등록되었습니다.");
    }
    //장소 검색
    @GetMapping
    public ApiResponse<List<PlaceSearchResultListResponse>> searchPlace(@RequestParam("query") String query){
        List<PlaceSearchResultListResponse> response = mapService.searchPlace(query);
        return ApiResponse.success(response);
    }
    //최근 검색한 장소 목록
    @GetMapping("/recent")
    public ApiResponse<List<PlaceSearchRecentListResponse>> getRecentSearchPlace(@CurrentUserId Long userId,
                                                                                 @RequestParam("limit") int limit){
        List<PlaceSearchRecentListResponse> response = mapService.getRecentSearchPlace(userId, limit);
        return ApiResponse.success(response);
    }

    //특정 검색 장소 기록 삭제
    @DeleteMapping("/recent/{recentPlaceId}")
    public ApiResponse<Void> deleteRecentSearchPlace(@CurrentUserId Long userId,
                                                     @PathVariable("recentPlaceId") Long placeId) {
        mapService.deleteRecentSearchPlace(userId, placeId);
        return ApiResponse.success("최근 검색어가 삭제되었습니다.");
    }

    // 경로 조회
    @GetMapping("/path")
    public ResponseEntity<ApiResponse<PathResponseDto>> getPath(
            @CurrentUserId Long userId,
            @RequestParam("startLat") @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal startLat,
            @RequestParam("startLng") @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal startLng,
            @RequestParam("endLat") @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal endLat,
            @RequestParam("endLng") @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal endLng
    ) {
        PathResponseDto responseDto = mapService.getPath(userId, startLat, startLng, endLat, endLng);
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }

    // 경로 재조회
    @GetMapping("/re-route")
    public ResponseEntity<ApiResponse<PathResponseDto>> getReRoutePath(
            @CurrentUserId Long userId,
            @RequestParam("startLat") @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal startLat,
            @RequestParam("startLng") @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal startLng,
            @RequestParam("endLat") @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal endLat,
            @RequestParam("endLng") @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal endLng,
            @RequestParam(value = "startStationId", required = false) String startStationId,
            @RequestParam(value = "endStationId", required = false) String endStationId,
            @RequestParam("travelStatus") TravelStatus travelStatus,
            @RequestParam("routeType") RouteType routeType
            ) {
        PathResponseDto responseDto = mapService.getReRoutePath(userId, startLat, startLng, endLat, endLng,
                startStationId, endStationId, travelStatus, routeType);
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }
}
