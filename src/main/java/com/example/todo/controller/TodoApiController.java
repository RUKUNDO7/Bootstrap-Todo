package com.example.todo.controller;

import com.example.todo.model.TodoItem;
import com.example.todo.security.AppUserPrincipal;
import com.example.todo.service.TodoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

import java.util.List;

@RestController
@RequestMapping("/todos")
@Validated
public class TodoApiController {
  private final TodoService service;

  public TodoApiController(TodoService service) {
    this.service = service;
  }

  private Long ownerId(AppUserPrincipal principal) {
    return principal.getId();
  }

  @GetMapping
  public List<TodoItem> list(@AuthenticationPrincipal AppUserPrincipal principal) {
    return service.findAll(ownerId(principal));
  }

  @GetMapping("/{id}")
  public ResponseEntity<TodoItem> getById(@AuthenticationPrincipal AppUserPrincipal principal,
                                          @PathVariable long id) {
    return service.findById(ownerId(principal), id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @GetMapping("/title/{title}")
  public List<TodoItem> getByTitle(@AuthenticationPrincipal AppUserPrincipal principal,
                                   @PathVariable String title) {
    return service.findByTitle(ownerId(principal), title);
  }

  @PostMapping
  public ResponseEntity<TodoItem> create(@AuthenticationPrincipal AppUserPrincipal principal,
                                         @Valid @RequestBody CreateTodoRequest request) {
    TodoItem created = service.add(ownerId(principal), request.title().trim());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{id}")
  public ResponseEntity<TodoItem> updateById(@AuthenticationPrincipal AppUserPrincipal principal,
                                             @PathVariable long id,
                                             @Valid @RequestBody UpdateTodoRequest request) {
    return service.update(ownerId(principal), id, request.title().trim(), request.status())
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/title/{title}")
  public ResponseEntity<List<TodoItem>> updateByTitle(@AuthenticationPrincipal AppUserPrincipal principal,
                                                      @PathVariable String title,
                                                      @Valid @RequestBody UpdateTodoRequest request) {
    List<TodoItem> updated = service.updateByTitle(ownerId(principal), title, request.title().trim(), request.status());
    if (updated.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(updated);
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<TodoItem> toggle(@AuthenticationPrincipal AppUserPrincipal principal,
                                         @PathVariable long id) {
    return service.toggle(ownerId(principal), id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@AuthenticationPrincipal AppUserPrincipal principal,
                                     @PathVariable long id) {
    boolean removed = service.delete(ownerId(principal), id);
    return removed ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
  }

  @DeleteMapping("/title/{title}")
  public ResponseEntity<Void> deleteByTitle(@AuthenticationPrincipal AppUserPrincipal principal,
                                            @PathVariable String title) {
    long removed = service.deleteByTitle(ownerId(principal), title);
    return removed > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
  }

  @DeleteMapping("/status/true")
  public ResponseEntity<Void> clearCompleted(@AuthenticationPrincipal AppUserPrincipal principal) {
    service.clearCompleted(ownerId(principal));
    return ResponseEntity.noContent().build();
  }

  public record CreateTodoRequest(@NotBlank(message = "Title is required") String title) {
  }

  public record UpdateTodoRequest(@NotBlank(message = "Title is required") String title,
                                  @NotNull(message = "Status is required") Boolean status) {
  }
}
