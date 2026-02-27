package com.example.todo.repository;

import com.example.todo.model.TodoItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoRepository extends JpaRepository<TodoItem, Long> {
  long deleteByStatusTrue();
  List<TodoItem> findByTitleContainingIgnoreCase(String title);
  List<TodoItem> findByTitleIgnoreCase(String title);
  long deleteByTitleIgnoreCase(String title);
}
