package com.s15p21b103.good_tashu.user.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import com.s15p21b103.good_tashu.user.dto.res.UserResponseDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/api/users/")
public class UserController {
//    @GetMapping("/me")
//    public ResponseEntity<ApiResponse<UserResponseDto>> getMyInfo(
//            @AuthenticationPrincipal Jwt jwt
//    ) {
//        return ResponseEntity.ok(ApiResponse.success(new UserResponseDto(jwt.getSubject())));
//    }
}
