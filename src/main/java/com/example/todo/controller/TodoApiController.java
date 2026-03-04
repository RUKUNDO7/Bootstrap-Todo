package com.example.todo.controller;

import com.example.todo.model.TodoItem;
import com.example.todo.service.TodoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/todos")
@Validated
public class TodoApiController {
  private final TodoService service;

  public TodoApiController(TodoService service) {
    this.service = service;
  }

  @GetMapping
  public List<TodoItem> list() {
    return service.findAll();
  }

  @GetMapping("/{id}")
  public ResponseEntity<TodoItem> getById(@PathVariable long id) {
    return service.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @GetMapping("/title/{title}")
  public List<TodoItem> getByTitle(@PathVariable String title) {
    return service.findByTitle(title);
  }

  @PostMapping
  public ResponseEntity<TodoItem> create(@Valid @RequestBody CreateTodoRequest request) {
    TodoItem created = service.add(request.title().trim(), request.dueAt());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{id}")
  public ResponseEntity<TodoItem> updateById(@PathVariable long id,
                                             @Valid @RequestBody UpdateTodoRequest request) {
    return service.update(id, request.title().trim(), request.status(), request.dueAt())
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/title/{title}")
  public ResponseEntity<List<TodoItem>> updateByTitle(@PathVariable String title,
                                                      @Valid @RequestBody UpdateTodoRequest request) {
    List<TodoItem> updated = service.updateByTitle(title, request.title().trim(), request.status(), request.dueAt());
    if (updated.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(updated);
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<TodoItem> toggle(@PathVariable long id) {
    return service.toggle(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable long id) {
    boolean removed = service.delete(id);
    return removed ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
  }

  @DeleteMapping("/title/{title}")
  public ResponseEntity<Void> deleteByTitle(@PathVariable String title) {
    long removed = service.deleteByTitle(title);
    return removed > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
  }

  @DeleteMapping("/status/true")
  public ResponseEntity<Void> clearCompleted() {
    service.clearCompleted();
    return ResponseEntity.noContent().build();
  }

  public record CreateTodoRequest(@NotBlank(message = "Title is required") String title,
                                  LocalDateTime dueAt) {
  }

  public record UpdateTodoRequest(@NotBlank(message = "Title is required") String title,
                                  @NotNull(message = "Status is required") Boolean status,
                                  LocalDateTime dueAt) {
  }
}
