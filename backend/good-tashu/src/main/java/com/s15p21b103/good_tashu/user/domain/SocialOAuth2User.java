package com.s15p21b103.good_tashu.user.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

@Getter
@RequiredArgsConstructor
public class SocialOAuth2User implements OAuth2User {
    private final long userId;           // 우리 DB의 회원 ID
    private final OAuth2User delegate;    // 카카오 사용자 정보
    private final Set<GrantedAuthority> authorities;
    @Override
    public Map<String, Object> getAttributes() {
        return delegate.getAttributes();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getName() {
        return delegate.getName();
    }
}
