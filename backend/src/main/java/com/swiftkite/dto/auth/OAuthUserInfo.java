package com.swiftkite.dto.auth;

import com.swiftkite.enums.AuthProvider;
import java.util.Map;
import lombok.Data;
import org.springframework.security.oauth2.core.user.OAuth2User;

@Data
public class OAuthUserInfo {
    private String providerId;
    private String email;
    private String firstName;
    private String lastName;
    private AuthProvider provider;

    public static OAuthUserInfo fromGoogle(OAuth2User user) {
        Map<String, Object> attrs = user.getAttributes();
        OAuthUserInfo info = new OAuthUserInfo();
        info.setProviderId((String) attrs.get("sub"));
        info.setEmail((String) attrs.get("email"));
        info.setFirstName((String) attrs.get("given_name"));
        info.setLastName((String) attrs.get("family_name"));
        info.setProvider(AuthProvider.GOOGLE);
        return info;
    }
}
