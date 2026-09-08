package com.s15p21b103.good_tashu.user.service;

import com.s15p21b103.good_tashu.user.domain.SocialLoginProvider;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserErrorCode;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    public UserEntity findOrCreate(SocialLoginProvider provider, OAuth2User oauth2User) {
        return userRepository.findByProviderAndProviderUserId(provider, oauth2User.getName())
                .orElseGet(()->userRepository.save(UserEntity.builder()
                        .provider(provider)
                        .providerUserId(oauth2User.getName())
                        .nickname(null)
                        .build()));
    }
}
