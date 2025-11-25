package com.wildcastradio.User;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
    List<UserEntity> findByRole(UserEntity.UserRole role);

    // Case-insensitive email lookup methods
    Optional<UserEntity> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    // Analytics count methods
    long countByRole(UserEntity.UserRole role);

    // Search users by name or email
    @Query("SELECT u FROM UserEntity u WHERE LOWER(u.firstname) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.lastname) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<UserEntity> searchUsers(@Param("query") String query, Pageable pageable);

    // Search users by name or email and filter by role
    @Query("SELECT u FROM UserEntity u WHERE (LOWER(u.firstname) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.lastname) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))) AND u.role = :role")
    Page<UserEntity> searchUsersByRole(@Param("query") String query, @Param("role") UserEntity.UserRole role, Pageable pageable);

    // Find all users by role (paginated)
    Page<UserEntity> findByRole(UserEntity.UserRole role, Pageable pageable);
}
