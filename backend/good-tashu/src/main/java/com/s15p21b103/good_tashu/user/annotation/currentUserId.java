package com.s15p21b103.good_tashu.user.annotation;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.lang.annotation.*;

@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal(
        expression = "userId",
        errorOnInvalidType = true
)
public @interface currentUserId {
}
