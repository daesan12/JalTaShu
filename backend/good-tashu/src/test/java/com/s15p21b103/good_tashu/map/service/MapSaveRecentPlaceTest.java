package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.domain.RecentPlaceEntity;
import com.s15p21b103.good_tashu.map.domain.req.RecentPlaceRequest;
import com.s15p21b103.good_tashu.map.repository.RecentPlaceRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MapSaveRecentPlaceTest {
    private final RecentPlaceRepository places = mock(RecentPlaceRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final MapService service = new MapService(
            mock(com.s15p21b103.good_tashu.map.client.NaverPlaceClient.class), places, users);

    @Test
    void savesSelectedPlaceWithCorrectCoordinates() {
        var user = mock(UserEntity.class);
        when(users.findById(1L)).thenReturn(Optional.of(user));
        var request = new RecentPlaceRequest("대전역", "주소", "도로명주소",
                new BigDecimal("127.4342001"), new BigDecimal("36.3323500"));

        service.saveRecentPlace(1L, request);

        var captor = ArgumentCaptor.forClass(RecentPlaceEntity.class);
        verify(places).save(captor.capture());
        var saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getPlace()).isEqualTo(request.title());
        assertThat(saved.getAddress()).isEqualTo(request.address());
        assertThat(saved.getRoadAddress()).isEqualTo(request.roadAddress());
        assertThat(saved.getLongitude()).isEqualByComparingTo(request.xPos());
        assertThat(saved.getLatitude()).isEqualByComparingTo(request.yPos());
    }

    @Test
    void rejectsMissingUser() {
        when(users.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.saveRecentPlace(1L,
                new RecentPlaceRequest("대전역", null, null, null, null)))
                .isInstanceOf(UserException.class);
        verifyNoInteractions(places);
    }
}
