package com.example.todo.repository;

import com.example.todo.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
  Optional<UserAccount> findByUsernameIgnoreCase(String username);

  boolean existsByUsernameIgnoreCase(String username);

  boolean existsByEmailIgnoreCase(String email);
}
