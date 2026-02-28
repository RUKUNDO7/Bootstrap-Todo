package com.example.todo.controller;

import com.example.todo.model.UserAccount;
import com.example.todo.model.UserRole;
import com.example.todo.repository.UserAccountRepository;
import com.example.todo.security.AppUserPrincipal;
import com.example.todo.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@Validated
public class AuthController {
  private final UserAccountRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationManager authenticationManager;
  private final JwtService jwtService;

  public AuthController(UserAccountRepository userRepository,
                        PasswordEncoder passwordEncoder,
                        AuthenticationManager authenticationManager,
                        JwtService jwtService) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.authenticationManager = authenticationManager;
    this.jwtService = jwtService;
  }

  @PostMapping("/signup")
  public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
    String username = request.username().trim();
    String email = request.email().trim().toLowerCase();
    String password = request.password();

    if (!isStrongPassword(password)) {
      return ResponseEntity.badRequest().body(Map.of(
          "message",
          "Password must be strong: at least 8 chars, uppercase, lowercase, number, and special character."
      ));
    }

    if (userRepository.existsByUsernameIgnoreCase(username)) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Username is already in use."));
    }
    if (userRepository.existsByEmailIgnoreCase(email)) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Email is already in use."));
    }

    UserAccount created = userRepository.save(
        new UserAccount(null, username, email, passwordEncoder.encode(password), UserRole.USER)
    );
    AppUserPrincipal principal = new AppUserPrincipal(created);
    String token = jwtService.generateToken(principal);

    return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponse.from(created, token));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
    try {
      authenticationManager.authenticate(
          new UsernamePasswordAuthenticationToken(request.username().trim(), request.password())
      );
    } catch (BadCredentialsException ex) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials."));
    }

    UserAccount user = userRepository.findByUsernameIgnoreCase(request.username().trim())
        .orElseThrow(() -> new BadCredentialsException("Invalid credentials."));
    AppUserPrincipal principal = new AppUserPrincipal(user);
    String token = jwtService.generateToken(principal);
    return ResponseEntity.ok(AuthResponse.from(user, token));
  }

  @GetMapping("/me")
  public ResponseEntity<UserView> me(@AuthenticationPrincipal AppUserPrincipal principal) {
    UserAccount user = userRepository.findById(principal.getId()).orElseThrow();
    return ResponseEntity.ok(UserView.from(user));
  }

  @GetMapping("/admin/ping")
  public ResponseEntity<Map<String, String>> adminPing() {
    return ResponseEntity.ok(Map.of("message", "Admin access granted."));
  }

  public record SignupRequest(
      @NotBlank(message = "Username is required")
      @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
      String username,
      @NotBlank(message = "Email is required")
      @Email(message = "Email is invalid")
      String email,
      @NotBlank(message = "Password is required")
      @Size(min = 8, max = 120, message = "Password must be between 8 and 120 characters")
      String password
  ) {
  }

  public record LoginRequest(
      @NotBlank(message = "Username is required")
      String username,
      @NotBlank(message = "Password is required")
      String password
  ) {
  }

  public record UserView(Long id, String username, String email, String role) {
    static UserView from(UserAccount user) {
      return new UserView(user.getId(), user.getUsername(), user.getEmail(), user.getRole().name());
    }
  }

  public record AuthResponse(String token, UserView user) {
    static AuthResponse from(UserAccount user, String token) {
      return new AuthResponse(token, UserView.from(user));
    }
  }

  private boolean isStrongPassword(String password) {
    return password.length() >= 8
        && password.chars().anyMatch(Character::isUpperCase)
        && password.chars().anyMatch(Character::isLowerCase)
        && password.chars().anyMatch(Character::isDigit)
        && password.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));
  }
}
