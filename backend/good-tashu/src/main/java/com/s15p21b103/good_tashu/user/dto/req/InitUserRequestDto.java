package com.s15p21b103.good_tashu.user.dto.req;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.Length;

import java.util.List;
import java.util.stream.Collectors;

public record InitUserRequestDto(List<List<String>> agrees, @NotNull @Size(min = 2, max = 10) @Pattern(regexp="^[a-zA-Z0-9ㄱ-ㅎ가-힣]*$") String nickname) {
    public InitUserRequestDto(List<List<String>> agrees, String nickname) {
        // Immutable
        this.agrees = agrees.stream()
                .map(List::copyOf).toList();
        this.nickname = nickname;
    }

}
