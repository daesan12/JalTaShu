package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.client.NaverPlaceClient;
import com.s15p21b103.good_tashu.map.domain.RecentPlaceEntity;
import com.s15p21b103.good_tashu.map.exception.MapException;
import com.s15p21b103.good_tashu.map.repository.RecentPlaceRepository;
import com.s15p21b103.good_tashu.user.exception.UserException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MapRecentPlaceTest {
    private final RecentPlaceRepository repository = mock(RecentPlaceRepository.class);
    private final MapService service = new MapService(mock(NaverPlaceClient.class), repository,
            mock(com.s15p21b103.good_tashu.user.repository.UserRepository.class));

    @Test
    void queriesUserRecordsWithLimitAndMapsCoordinates() {
        var place = new RecentPlaceEntity(null, "대전역", "주소", "도로명주소",
                new BigDecimal("127.4342001"), new BigDecimal("36.3323500"));
        when(repository.findByUser_UserIdOrderByCreatedAtDescRecentPlaceIdDesc(1L, PageRequest.of(0, 5)))
                .thenReturn(List.of(place));
        var results = service.getRecentSearchPlace(1L, 5);
        assertThat(results).hasSize(1);
        assertThat(results.getFirst().title()).isEqualTo(place.getPlace());
        assertThat(results.getFirst().address()).isEqualTo(place.getAddress());
        assertThat(results.getFirst().roadAddress()).isEqualTo(place.getRoadAddress());
        assertThat(results.getFirst().xPos()).isEqualByComparingTo(place.getLongitude());
        assertThat(results.getFirst().yPos()).isEqualByComparingTo(place.getLatitude());
        verify(repository).findByUser_UserIdOrderByCreatedAtDescRecentPlaceIdDesc(1L, PageRequest.of(0, 5));
    }

    @Test
    void returnsEmptyListWhenNoHistory() {
        when(repository.findByUser_UserIdOrderByCreatedAtDescRecentPlaceIdDesc(1L, PageRequest.of(0, 5)))
                .thenReturn(List.of());
        assertThat(service.getRecentSearchPlace(1L, 5)).isEmpty();
    }

    @Test
    void rejectsInvalidLimitAndMissingUser() {
        assertThatThrownBy(() -> service.getRecentSearchPlace(1L, 0)).isInstanceOf(MapException.class);
        assertThatThrownBy(() -> service.getRecentSearchPlace(1L, -1)).isInstanceOf(MapException.class);
        assertThatThrownBy(() -> service.getRecentSearchPlace(null, 5)).isInstanceOf(UserException.class);
        verifyNoInteractions(repository);
    }
}
