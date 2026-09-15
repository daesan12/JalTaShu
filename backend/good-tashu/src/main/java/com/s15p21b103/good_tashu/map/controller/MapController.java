package com.s15p21b103.good_tashu.map.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.map.domain.res.PlaceSearchRecentListResponse;
import com.s15p21b103.good_tashu.map.domain.res.PlaceSearchResultListResponse;
import com.s15p21b103.good_tashu.map.service.MapService;
import com.s15p21b103.good_tashu.map.domain.req.RecentPlaceRequest;
import jakarta.validation.Valid;
import com.s15p21b103.good_tashu.user.annotation.currentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/map")
public class MapController {
    private final MapService mapService;

    // 최근 선택한 장소 최근 검색어에 등록
    @PostMapping("/location/recent")
    public ApiResponse<Void> saveRecentPlace(@currentUserId Long userId,
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
    public ApiResponse<List<PlaceSearchRecentListResponse>> getRecentSearchPlace(@currentUserId Long userId,
                                                                                 @RequestParam("limit") int limit){
        List<PlaceSearchRecentListResponse> response = mapService.getRecentSearchPlace(userId, limit);
        return ApiResponse.success(response);
    }

    //특정 검색 장소 기록 삭제
    @DeleteMapping("/recent/{recentPlaceId}")
    public ApiResponse<Void> deleteRecentSearchPlace(@currentUserId Long userId,
                                                     @PathVariable("recentPlaceId") Long placeId) {
        mapService.deleteRecentSearchPlace(userId, placeId);
        return ApiResponse.success("최근 검색어가 삭제되었습니다.");
    }
}
