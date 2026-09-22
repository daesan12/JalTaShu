package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.client.NaverPlaceClient;
import com.s15p21b103.good_tashu.map.client.dto.NaverPlaceItem;
import com.s15p21b103.good_tashu.map.client.dto.NaverPlaceResponse;
import com.s15p21b103.good_tashu.map.exception.MapException;
import com.s15p21b103.good_tashu.map.repository.RecentPlaceRepository;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MapServiceTest {
    private final NaverPlaceClient client = mock(NaverPlaceClient.class);
    private final MapService service = new MapService(client, mock(RecentPlaceRepository.class), mock(UserRepository.class), mock(PathService.class));

    @Test
    void convertsNaverResultAndCoordinates() {
        when(client.search("대전역")).thenReturn(new NaverPlaceResponse(List.of(
                new NaverPlaceItem("<b>대전역</b> &amp; 주변", "지번 주소", "도로명 주소", "1274342001", "363323500"))));
        var result = service.searchPlace("  대전역  ").getFirst();
        assertThat(result.title()).isEqualTo("대전역 & 주변");
        assertThat(result.address()).isEqualTo("지번 주소");
        assertThat(result.roadAddress()).isEqualTo("도로명 주소");
        assertThat(result.xPos()).isEqualByComparingTo("127.4342001");
        assertThat(result.yPos()).isEqualByComparingTo("36.3323500");
        verify(client).search("대전역");
    }

    @Test
    void returnsEmptyListWhenNaverHasNoItems() {
        when(client.search("없는 장소")).thenReturn(new NaverPlaceResponse(List.of()));
        assertThat(service.searchPlace("없는 장소")).isEmpty();
    }

    @Test
    void rejectsBlankQuery() {
        assertThatThrownBy(() -> service.searchPlace("  ")).isInstanceOf(MapException.class);
        verifyNoInteractions(client);
    }

    @Test
    void rejectsInvalidNaverResult() {
        when(client.search("장소")).thenReturn(new NaverPlaceResponse(List.of(
                new NaverPlaceItem(null, "주소", "도로명", "127", "36"))));
        assertThatThrownBy(() -> service.searchPlace("장소")).isInstanceOf(MapException.class);
    }
}
