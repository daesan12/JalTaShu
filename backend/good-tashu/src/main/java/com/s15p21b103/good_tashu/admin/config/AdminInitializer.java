package com.s15p21b103.good_tashu.admin.config;

import com.s15p21b103.good_tashu.admin.service.AdminUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Runs once per application startup when explicitly enabled; existing accounts remain unchanged. */
@Component
@ConditionalOnProperty(prefix = "admin.bootstrap", name = "enabled", havingValue = "true")
public class AdminInitializer implements ApplicationRunner {
    private final AdminUserService adminUserService;
    private final String id;
    private final String password;

    public AdminInitializer(AdminUserService adminUserService,
                            @Value("${admin.bootstrap.id:}") String id,
                            @Value("${admin.bootstrap.password:}") String password) {
        this.adminUserService = adminUserService;
        this.id = id;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Call through the service bean so @Transactional is applied. Never log credentials.
        adminUserService.registerAdmin(id, password);
    }
}
