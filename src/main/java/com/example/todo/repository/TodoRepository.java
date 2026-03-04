package com.example.todo.repository;

import com.example.todo.model.TodoItem;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoRepository extends JpaRepository<TodoItem, Long> {
  List<TodoItem> findByTitleContainingIgnoreCase(String title, Sort sort);
  List<TodoItem> findByTitleIgnoreCase(String title);
  long deleteByTitleIgnoreCase(String title);
  long deleteByStatusTrue();
}
