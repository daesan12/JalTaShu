package com.s15p21b103.good_tashu.user.interceptor;


import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import com.s15p21b103.good_tashu.user.annotation.BlockBanUser;
import com.s15p21b103.good_tashu.user.exception.UserException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.BANNED_USER;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.FORBIDDEN;

@Component
@RequiredArgsConstructor
public class BanUserInterceptor implements HandlerInterceptor {
    private final UserBanRecordRepository userBanRecordRepository;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)
            || !handlerMethod.hasMethodAnnotation(BlockBanUser.class)) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            throw new UserException(FORBIDDEN);
        }

        Long userId = Long.valueOf(jwtAuthentication.getToken().getSubject());
        LocalDateTime now = LocalDateTime.now();
        Optional<UserBanRecordEntity> activeBan = userBanRecordRepository
                .findLatestActiveBan(userId, now);
        if (activeBan.isPresent()) {
            throw new UserException(BANNED_USER, activeBan.get().getComment());
        }

        return true;
    }
}
