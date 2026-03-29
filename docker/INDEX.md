# Claude Code CLI Docker Sandbox - Complete Index

## Quick Navigation

**New to this setup?** Start here:
- [QUICKSTART.md](QUICKSTART.md) - Get running in 5 minutes

**Need complete information?**
- [README.md](README.md) - Full documentation (405 lines)

**Looking for specific examples?**
- [EXAMPLES.md](EXAMPLES.md) - Real-world usage scenarios (466 lines)

**Understanding the files?**
- [MANIFEST.md](MANIFEST.md) - File overview and reference (294 lines)

---

## File Reference

### Essential Files (Start Here)

| File | Type | Purpose | Size | Lines |
|------|------|---------|------|-------|
| [QUICKSTART.md](QUICKSTART.md) | Guide | 5-minute setup | 3.7 KB | 174 |
| [README.md](README.md) | Docs | Complete reference | 9.6 KB | 405 |
| [EXAMPLES.md](EXAMPLES.md) | Guide | Usage examples | 12 KB | 466 |
| [MANIFEST.md](MANIFEST.md) | Reference | File overview | 7.6 KB | 294 |

### Core Docker Configuration

| File | Type | Purpose | Size | Lines |
|------|------|---------|------|-------|
| [Dockerfile](Dockerfile) | Config | Container definition | 1.4 KB | 53 |
| [docker-compose.yml](docker-compose.yml) | Config | Compose setup | 1.5 KB | 62 |
| [.dockerignore](.dockerignore) | Config | Build exclusions | 604 B | 64 |
| [.env.example](.env.example) | Template | Environment vars | 1.2 KB | 39 |

### Helper Scripts (Executable)

| File | Type | Purpose | Size | Lines |
|------|------|---------|------|-------|
| [build.sh](build.sh) | Script | Build automation | 2.7 KB | 86 |
| [run.sh](run.sh) | Script | Run automation | 4.0 KB | 164 |
| [verify.sh](verify.sh) | Script | Setup verification | 8.5 KB | 297 |

---

## Learning Paths

### Path 1: Absolute Beginner
1. Read: [QUICKSTART.md](QUICKSTART.md)
2. Run: `./verify.sh`
3. Run: `./build.sh`
4. Run: `./run.sh -i`
5. Reference: [README.md](README.md) when needed

### Path 2: Need Specific Examples
1. Run: `./build.sh`
2. Check: [EXAMPLES.md](EXAMPLES.md)
3. Find the example matching your need
4. Run the command
5. Refer to [README.md](README.md) for troubleshooting

### Path 3: CI/CD Integration
1. Read: [EXAMPLES.md#cicd-integration](EXAMPLES.md)
2. Check: GitHub Actions and GitLab CI examples
3. Copy workflow to your repository
4. Customize for your needs
5. Refer to [README.md](README.md) for advanced options

### Path 4: Advanced Usage
1. Read: [README.md#advanced-usage](README.md)
2. Review: [EXAMPLES.md#advanced-scenarios](EXAMPLES.md)
3. Check: [MANIFEST.md#customization](MANIFEST.md)
4. Customize [Dockerfile](Dockerfile) as needed
5. Test with: `./build.sh --no-cache`

---

## Quick Command Reference

### Setup & Verification
```bash
# Navigate to docker directory
cd /home/miso/projects/strabismus-measurement-app/docker

# Verify everything is ready
./verify.sh

# Build Docker image (one-time)
./build.sh
```

### Running the Container
```bash
# Interactive shell
./run.sh -i

# Run specific command
./run.sh "claude-code analyze src/"

# Background mode
./run.sh -d "claude-code analyze src/"

# With custom container name
./run.sh -n my-analyzer "claude-code analyze src/"

# Multiple volumes
./run.sh -v /data:/workspace/data "command"
```

### Using Docker Compose
```bash
# Interactive
docker-compose up -it

# Background
docker-compose up -d

# Execute command
docker-compose exec claude-code "command"

# Logs
docker-compose logs -f

# Cleanup
docker-compose down
```

### Inside Container
```bash
# Analyze code
claude-code analyze src/ --dangerously-skip-permissions

# Refactor file
claude-code refactor --file src/main.tsx --dangerously-skip-permissions

# Get help
claude-code --help
```

---

## Feature Matrix

### What Each Document Covers

| Feature | QUICKSTART | README | EXAMPLES | MANIFEST |
|---------|-----------|--------|----------|----------|
| Setup instructions | ✓ | ✓ | | |
| Basic usage | ✓ | ✓ | ✓ | |
| Advanced usage | | ✓ | ✓ | ✓ |
| Code analysis examples | | | ✓ | |
| Refactoring examples | | | ✓ | |
| Batch operations | | | ✓ | |
| CI/CD integration | | ✓ | ✓ | |
| Troubleshooting | ✓ | ✓ | | |
| Security info | | ✓ | | ✓ |
| File reference | | | | ✓ |
| Customization | | ✓ | | ✓ |
| FAQ | | ✓ | | |

---

## Common Questions

**Q: Where do I start?**
A: Read [QUICKSTART.md](QUICKSTART.md) (5 minutes), then run `./build.sh`

**Q: How do I run a specific Claude Code command?**
A: Check [EXAMPLES.md](EXAMPLES.md) for your use case

**Q: I need to understand the security model**
A: See [README.md#security-considerations](README.md)

**Q: I want to integrate this into CI/CD**
A: See [EXAMPLES.md#cicd-integration](EXAMPLES.md)

**Q: Something isn't working**
A: Run `./verify.sh` to diagnose, then check [README.md#troubleshooting](README.md)

**Q: What files do I actually need?**
A: The three main files are:
- Dockerfile (container definition)
- docker-compose.yml (optional but recommended)
- Helper scripts (optional but convenient)

All documentation is extra, but highly recommended!

---

## File Dependency Graph

```
Required to Build:
  Dockerfile ─→ .dockerignore (optimization only)

Optional:
  docker-compose.yml (alternative to manual docker run)
  .env.example (configuration template)

Helper Scripts:
  build.sh → Dockerfile, .dockerignore
  run.sh → Docker image (built by build.sh)
  verify.sh → (all files, for verification)

Documentation:
  QUICKSTART.md → guides to build.sh, run.sh
  README.md → comprehensive reference
  EXAMPLES.md → real-world use cases
  MANIFEST.md → file reference
  INDEX.md → this file
```

---

## File Size Statistics

```
Total Lines of Code:    ~1,940 lines
Total Documentation:    ~1,339 lines (69%)
Total Configuration:    ~179 lines (9%)
Total Scripts:          ~422 lines (22%)

Storage:
  Total Size:           64 KB
  Documentation:        32 KB (50%)
  Configuration:        5 KB (8%)
  Scripts:              15 KB (23%)
  Metadata:             12 KB (19%)
```

---

## Build & Runtime Information

### Container Image
- Base: Node.js 20 LTS Alpine
- Size: ~200-300 MB
- Build time: 2-3 minutes (first), 5-10 seconds (cached)
- User: claude (non-root)

### Runtime Requirements
- Docker: 20.10+
- Docker Compose: 1.29+ (optional)
- Disk: 1 GB minimum
- Memory: 2 GB recommended
- CPU: 2 cores recommended

### Included Tools
- Node.js 20 LTS
- Claude Code CLI (latest)
- Git, cURL, SSH, Bash
- Build tools (gcc, make, python3)
- CA certificates

---

## Next Steps

1. **Verify**: `./verify.sh` - Check everything is ready
2. **Build**: `./build.sh` - Create Docker image
3. **Run**: `./run.sh -i` - Start interactive container
4. **Use**: `claude-code analyze src/` - Run Claude Code inside
5. **Learn**: Read [README.md](README.md) for advanced features

---

## Support

| Topic | Resource |
|-------|----------|
| Claude Code | https://github.com/anthropics/claude-code |
| Docker | https://docs.docker.com/ |
| Docker Compose | https://docs.docker.com/compose/ |
| Best Practices | https://docs.docker.com/develop/ |

---

## Document Statistics

| Document | Type | Length | Audience | Purpose |
|----------|------|--------|----------|---------|
| INDEX.md | Reference | This file | Everyone | Navigation guide |
| QUICKSTART.md | Guide | 174 lines | Beginners | Quick setup |
| README.md | Docs | 405 lines | Users | Complete reference |
| EXAMPLES.md | Guide | 466 lines | Developers | Usage patterns |
| MANIFEST.md | Reference | 294 lines | Everyone | File overview |

---

**Created**: 2026-03-25
**Status**: Production Ready
**Version**: 1.0

---

Need help? Start with [QUICKSTART.md](QUICKSTART.md)
