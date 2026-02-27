package com.example.todo.service;

import com.example.todo.model.TodoItem;
import com.example.todo.repository.TodoRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class TodoService {
  private final TodoRepository repository;

  public TodoService(TodoRepository repository) {
    this.repository = repository;
  }

  public List<TodoItem> findAll() {
    Sort sort = Sort.by(Sort.Order.asc("status"), Sort.Order.asc("id"));
    return repository.findAll(sort);
  }

  public List<TodoItem> findByTitle(String title) {
    return repository.findByTitleContainingIgnoreCase(title);
  }

  public TodoItem add(String title) {
    TodoItem item = new TodoItem(null, title, false);
    return repository.save(item);
  }

  public Optional<TodoItem> findById(long id) {
    return repository.findById(id);
  }

  @Transactional
  public Optional<TodoItem> update(long id, String title, boolean status) {
    Optional<TodoItem> item = repository.findById(id);
    item.ifPresent(i -> {
      i.setTitle(title);
      i.setStatus(status);
    });
    return item;
  }

  @Transactional
  public List<TodoItem> updateByTitle(String title, String newTitle, boolean status) {
    List<TodoItem> items = repository.findByTitleIgnoreCase(title);
    items.forEach(i -> {
      i.setTitle(newTitle);
      i.setStatus(status);
    });
    return repository.saveAll(items);
  }

  @Transactional
  public Optional<TodoItem> toggle(long id) {
    Optional<TodoItem> item = repository.findById(id);
    item.ifPresent(i -> i.setStatus(!i.isStatus()));
    return item;
  }

  public boolean delete(long id) {
    if (!repository.existsById(id)) {
      return false;
    }
    repository.deleteById(id);
    return true;
  }

  public long deleteByTitle(String title) {
    return repository.deleteByTitleIgnoreCase(title);
  }

  public void clearCompleted() {
    repository.deleteByStatusTrue();
  }
}
