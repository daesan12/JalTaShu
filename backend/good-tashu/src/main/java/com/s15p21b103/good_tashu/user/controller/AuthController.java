package com.s15p21b103.good_tashu.user.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import com.s15p21b103.good_tashu.user.dto.req.InitUserRequestDto;
import com.s15p21b103.good_tashu.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserService userService;
    @PostMapping("/sign-up")
    public ResponseEntity<ApiResponse<Void>> signUp(
            @AuthenticationPrincipal SocialOAuth2User user,
            @RequestBody @Valid InitUserRequestDto request
    ) {
        userService.signUp(user.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.success("가입에 성공했습니다."));
    }
}
