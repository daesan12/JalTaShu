package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.dto.res.WeatherResponse;
import com.s15p21b103.good_tashu.map.repository.WeatherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WeatherService {
    private final WeatherRepository weatherRepository;

    public WeatherResponse getLatest() {
        return weatherRepository.findLatest();
    }
}
