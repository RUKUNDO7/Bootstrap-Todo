package com.example.todo.service;

import com.example.todo.model.TodoItem;
import com.example.todo.model.UserAccount;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserAccountRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class TodoService {
  private final TodoRepository repository;
  private final UserAccountRepository userAccountRepository;

  public TodoService(TodoRepository repository, UserAccountRepository userAccountRepository) {
    this.repository = repository;
    this.userAccountRepository = userAccountRepository;
  }

  public List<TodoItem> findAll(Long ownerId) {
    Sort sort = Sort.by(Sort.Order.asc("status"), Sort.Order.asc("id"));
    return repository.findByOwnerId(ownerId, sort);
  }

  public List<TodoItem> findByTitle(Long ownerId, String title) {
    return repository.findByOwnerIdAndTitleContainingIgnoreCase(ownerId, title);
  }

  public TodoItem add(Long ownerId, String title) {
    UserAccount owner = userAccountRepository.findById(ownerId).orElseThrow();
    TodoItem item = new TodoItem(null, title, false, owner);
    return repository.save(item);
  }

  public Optional<TodoItem> findById(Long ownerId, long id) {
    return repository.findByIdAndOwnerId(id, ownerId);
  }

  @Transactional
  public Optional<TodoItem> update(Long ownerId, long id, String title, boolean status) {
    Optional<TodoItem> item = repository.findByIdAndOwnerId(id, ownerId);
    item.ifPresent(i -> {
      i.setTitle(title);
      i.setStatus(status);
    });
    return item;
  }

  @Transactional
  public List<TodoItem> updateByTitle(Long ownerId, String title, String newTitle, boolean status) {
    List<TodoItem> items = repository.findByOwnerIdAndTitleIgnoreCase(ownerId, title);
    items.forEach(i -> {
      i.setTitle(newTitle);
      i.setStatus(status);
    });
    return repository.saveAll(items);
  }

  @Transactional
  public Optional<TodoItem> toggle(Long ownerId, long id) {
    Optional<TodoItem> item = repository.findByIdAndOwnerId(id, ownerId);
    item.ifPresent(i -> i.setStatus(!i.isStatus()));
    return item;
  }

  public boolean delete(Long ownerId, long id) {
    return repository.deleteByIdAndOwnerId(id, ownerId) > 0;
  }

  public long deleteByTitle(Long ownerId, String title) {
    return repository.deleteByOwnerIdAndTitleIgnoreCase(ownerId, title);
  }

  public void clearCompleted(Long ownerId) {
    repository.deleteByOwnerIdAndStatusTrue(ownerId);
  }
}
