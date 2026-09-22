package com.s15p21b103.good_tashu.user.config;

import com.s15p21b103.good_tashu.user.interceptor.BanUserInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class UserWebConfig implements WebMvcConfigurer {
    private final BanUserInterceptor banUserInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(banUserInterceptor)
                .addPathPatterns("/api/**");
    }
}
