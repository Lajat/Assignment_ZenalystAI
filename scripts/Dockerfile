FROM alpine:3.20

# tini is the actual fix for the crond "setpgid: Operation not permitted"
# error — busybox crond forks jobs into a new process group, which many
# container runtimes reject when crond runs directly as PID 1 (no real init
# process). Running crond under tini gives it a proper init/session leader,
# so its child processes can get a process group normally.
RUN apk add --no-cache mongodb-tools postgresql-client dcron bash tini

COPY backup.sh /usr/local/bin/backup.sh
# Strip Windows-style CRLF line endings if present — a CRLF shebang line
# (#!/bin/bash\r) causes exactly "not found" / exit 127 even though the
# file exists, since \r isn't part of a valid interpreter path.
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Every 5 minute for testing — switch to "0 2 * * *" (nightly at 2am) once confirmed working.
RUN echo "*/5 * * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["crond", "-f", "-l", "2"]