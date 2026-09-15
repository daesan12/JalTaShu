package com.s15p21b103.good_tashu.user.domain;

import com.s15p21b103.good_tashu.user.exception.UserErrorCode;
import com.s15p21b103.good_tashu.user.exception.UserException;

import java.util.Arrays;

public enum SocialLoginProvider {
    KAKAO,
    NAVER,
    GOOGLE;

    public static SocialLoginProvider from(String provider) {
        return Arrays.stream(values())
                .filter(platform -> platform.name().equalsIgnoreCase(provider))
                .findFirst()
                .orElseThrow(() -> new UserException(UserErrorCode.UNSUPPORTED_OAUTH_PROVIDER));
    }

}
