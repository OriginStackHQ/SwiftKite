package com.swiftkite.services.implementation;

import com.swiftkite.dto.auth.ChangePasswordRequest;
import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.auth.UpdateProfileRequest;
import com.swiftkite.dto.user.MeResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.Role;
import com.swiftkite.entity.UserIdentity;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.enums.RoleName;
import com.swiftkite.exception.AppException;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.exception.PasswordMismatchException;
import com.swiftkite.exception.ResourceAlreadyExistsException;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.RoleRepository;
import com.swiftkite.repository.UserIdentityRepository;
import com.swiftkite.services.interfaces.IAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class AuthService implements IAuthService {

    private final ApplicationUserRepository applicationUserRepository;
    private final RoleRepository roleRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final SessionService sessionService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            ApplicationUserRepository applicationUserRepository,
            RoleRepository roleRepository,
            UserIdentityRepository userIdentityRepository,
            SessionService sessionService,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder) {
        this.applicationUserRepository = applicationUserRepository;
        this.roleRepository = roleRepository;
        this.userIdentityRepository = userIdentityRepository;
        this.sessionService = sessionService;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public MeResponse signUp(@Valid SignUpRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }

        String email = request.getEmail().toLowerCase();
        if (applicationUserRepository.findByEmail(email).isPresent()) {
            throw new ResourceAlreadyExistsException("An account with this email already exists.");
        }

        Role creatorRole = roleRepository
                .findByName(RoleName.CREATOR)
                .orElseThrow(() -> new NotFoundException("Creator role not found."));

        ApplicationUser user = new ApplicationUser();
        user.setEmail(email);
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoles(List.of(creatorRole));
        ApplicationUser saved = applicationUserRepository.save(user);

        UserIdentity localIdentity = new UserIdentity();
        localIdentity.setUser(saved);
        localIdentity.setProvider(AuthProvider.LOCAL);
        userIdentityRepository.save(localIdentity);

        return toMe(saved);
    }

    @Override
    public AuthResponse signIn(@Valid SignInRequest request) {
        String email = request.getEmail().toLowerCase();

        Authentication authentication;
        try {
            // The provider loads the user once via CustomUserDetailsService; reuse
            // that principal instead of re-querying by email.
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword()));
        } catch (AuthenticationException e) {
            // Failure path only: distinguish an OAuth-only account so the user
            // gets a useful "sign in with Google" hint instead of a bare 401.
            Optional<ApplicationUser> existing = applicationUserRepository.findByEmail(email);
            if (existing.isPresent() && existing.get().getPassword() == null) {
                throw new AppException(
                        "This email is linked to a Google account. Please sign in with Google instead.",
                        HttpStatus.CONFLICT);
            }
            throw new BadCredentialsException("Invalid email or password.");
        }

        ApplicationUser user = (ApplicationUser) authentication.getPrincipal();
        return sessionService.start(user);
    }

    @Override
    public AuthResponse refreshToken(String rawRefreshToken) {
        return sessionService.rotate(rawRefreshToken);
    }

    @Override
    public void signOut(String rawRefreshToken, String rawAccessToken) {
        sessionService.revoke(rawRefreshToken, rawAccessToken);
    }

    @Override
    @Transactional(readOnly = true)
    public MeResponse me(String email) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));
        return toMe(user);
    }

    @Override
    @Transactional
    public AuthResponse setPassword(String email, @Valid SetPasswordRequest request) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));

        if (user.getPassword() != null) {
            throw new AppException(
                    "Password is already set. Use change password instead.", HttpStatus.CONFLICT);
        }
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        applicationUserRepository.save(user);

        if (!userIdentityRepository.existsByUserAndProvider(user, AuthProvider.LOCAL)) {
            UserIdentity localIdentity = new UserIdentity();
            localIdentity.setUser(user);
            localIdentity.setProvider(AuthProvider.LOCAL);
            userIdentityRepository.save(localIdentity);
        }

        // Credential change invalidates existing sessions: rotate if one
        // exists so the caller stays signed in, everyone else is signed out.
        return sessionService.rotateFor(user);
    }

    @Override
    @Transactional
    public AuthResponse changePassword(String email, @Valid ChangePasswordRequest request) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));

        if (user.getPassword() == null) {
            throw new AppException("Set a password before changing it.", HttpStatus.CONFLICT);
        }
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new AppException("Current password is incorrect.", HttpStatus.BAD_REQUEST);
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException(
                    "New password must be different from the current password.", HttpStatus.BAD_REQUEST);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        applicationUserRepository.save(user);

        // Keep the caller signed in on a fresh token; other sessions die.
        return sessionService.rotateFor(user);
    }

    @Override
    @Transactional
    public MeResponse updateProfile(String email, @Valid UpdateProfileRequest request) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        return toMe(applicationUserRepository.save(user));
    }

    public MeResponse toMe(ApplicationUser user) {
        List<String> roles = user.getRoles().stream().map(role -> role.getName().name()).toList();
        List<String> providers = userIdentityRepository.findByUser(user).stream()
                .map(identity -> identity.getProvider().name())
                .toList();
        return new MeResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                roles,
                providers,
                user.getPassword() != null);
    }
}
