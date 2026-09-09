package com.s15p21b103.good_tashu.user.service;

import com.s15p21b103.good_tashu.user.domain.SocialLoginProvider;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SocialOAuth2UserService extends DefaultOAuth2UserService {
    private final UserService userService;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest)
            throws OAuth2AuthenticationException {
        // provider 얻기 (enum)
        SocialLoginProvider provider = SocialLoginProvider.from(userRequest.getClientRegistration().getRegistrationId());

        // 기본 OAuth2User 얻기
        OAuth2User oauth2User = super.loadUser(userRequest);
        // provider와 OAuth2User 기준으로 UserEntity를 획득하거나 생성
        UserEntity user = userService.findOrCreate(provider, oauth2User);

        Set<GrantedAuthority> authorities =
                new HashSet<>(oauth2User.getAuthorities());

        // 일반 사용자 권한 부여
        authorities.add(
                new SimpleGrantedAuthority("ROLE_USER")
        );

        return new SocialOAuth2User(
                user.getUserId(),
                oauth2User,
                authorities
        );
    }
}
