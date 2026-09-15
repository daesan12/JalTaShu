package com.s15p21b103.good_tashu.admin.annotation;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.lang.annotation.*;

@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal(expression = "adminId", errorOnInvalidType = true)
public @interface currentAdminId {
}
