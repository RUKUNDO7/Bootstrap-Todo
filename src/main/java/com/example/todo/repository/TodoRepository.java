package com.example.todo.repository;

import com.example.todo.model.TodoItem;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TodoRepository extends JpaRepository<TodoItem, Long> {
  List<TodoItem> findByOwnerId(Long ownerId, Sort sort);
  List<TodoItem> findByOwnerIdAndTitleContainingIgnoreCase(Long ownerId, String title);
  Optional<TodoItem> findByIdAndOwnerId(Long id, Long ownerId);
  List<TodoItem> findByOwnerIdAndTitleIgnoreCase(Long ownerId, String title);
  long deleteByOwnerIdAndTitleIgnoreCase(Long ownerId, String title);
  long deleteByOwnerIdAndStatusTrue(Long ownerId);
  long deleteByIdAndOwnerId(Long id, Long ownerId);
}
