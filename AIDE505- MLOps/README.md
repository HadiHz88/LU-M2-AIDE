# AIDE505 - MLOps

Testing, load testing, containers, Compose, end-to-end tests and CI/CD for a small
registration and login app.

## Lectures

The slides keep the teacher's numbering. Lectures 2, 3 and 6 are not here yet.

| # | Lecture | Labs |
| --- | --- | --- |
| 01 | What is DevOps, what is MLOps | |
| 04 | Version control | |
| 05 | Software testing, with 5.1 the 12-factor app's config | 01, 02, 03 |
| 07 | Docker and containers | 04, 05 |
| 08 | CI/CD | 06 |

## Labs

Each lab builds on the one before it, so do them in order.

| # | Lab | Handout | Starts from |
| --- | --- | --- | --- |
| 01 | Unit and integration testing (pytest) | `GUIDE.pdf` | `starter.zip` |
| 02 | Load testing (k6, Grafana Cloud) | `LOAD_GUIDE.pdf` | `starter.zip` |
| 03 | End-to-end testing (Playwright) | `E2E-NODE-GUIDE.pdf` | `starter.zip` |
| 04 | Docker containers | `DOCKER_GUIDE.pdf` | `starter.zip` |
| 05 | Docker Compose: frontend, backend, database | `COMPOSE_GUIDE.pdf` | lab 04's `starter.zip` |
| 06 | CI/CD with GitHub Actions | `CICD_EXERCISE.pdf` | the finished lab 05 app |

Every lab folder in `assignments/` holds:

- the handout PDF;
- `starter.zip`, the project the teacher gave, when there is one;
- `solution/`, only the files the solution adds or changes, never the whole project again;
- `SOLUTION_GUIDE.md`, the solution step by step, in the order of the handout.

To get a finished project, unzip the starting point and copy `solution/` over it. The
solution guide says which files to delete, if any.

`submissions/` holds the reports submitted for grading.
