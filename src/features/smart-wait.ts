import { SmartWaitConfig } from "../types.js";

// Default smart wait configuration
export const DEFAULT_SMART_WAIT_CONFIG: SmartWaitConfig = {
  baseWaitTime: 2000,
  patterns: [
    // Package managers - typically slow
    { pattern: /^(apt|apt-get|yum|dnf|pacman|brew)\s+(install|update|upgrade)/i, waitTime: 30000, description: "Package manager install/update" },
    { pattern: /^pip\s+install/i, waitTime: 15000, description: "Python pip install" },
    { pattern: /^npm\s+(install|ci|update)/i, waitTime: 20000, description: "npm install" },
    { pattern: /^yarn\s+(install|add)/i, waitTime: 20000, description: "yarn install" },
    { pattern: /^pnpm\s+(install|add)/i, waitTime: 20000, description: "pnpm install" },
    { pattern: /^cargo\s+(build|install)/i, waitTime: 30000, description: "Cargo build/install" },
    { pattern: /^go\s+(build|install|get)/i, waitTime: 15000, description: "Go build/install" },
    { pattern: /^gem\s+install/i, waitTime: 10000, description: "Ruby gem install" },
    { pattern: /^composer\s+(install|update)/i, waitTime: 15000, description: "PHP composer install" },

    // Build tools
    { pattern: /^make(\s|$)/i, waitTime: 20000, description: "Make build" },
    { pattern: /^cmake\s/i, waitTime: 15000, description: "CMake" },
    { pattern: /^gradle\s/i, waitTime: 30000, description: "Gradle build" },
    { pattern: /^mvn\s/i, waitTime: 30000, description: "Maven build" },
    { pattern: /^ninja\s/i, waitTime: 20000, description: "Ninja build" },

    // Docker operations
    { pattern: /^docker\s+(build|pull|push)/i, waitTime: 60000, description: "Docker build/pull/push" },
    { pattern: /^docker-compose\s+(up|build|pull)/i, waitTime: 45000, description: "Docker Compose" },
    { pattern: /^podman\s+(build|pull|push)/i, waitTime: 60000, description: "Podman build/pull/push" },

    // Kubernetes
    { pattern: /^kubectl\s+(apply|create|delete)\s/i, waitTime: 10000, description: "kubectl apply/create/delete" },
    { pattern: /^helm\s+(install|upgrade)/i, waitTime: 20000, description: "Helm install/upgrade" },

    // Cloud CLI operations
    { pattern: /^gcloud\s+(compute|container|run)\s/i, waitTime: 15000, description: "GCloud operations" },
    { pattern: /^aws\s+(ec2|ecs|eks|s3)\s/i, waitTime: 15000, description: "AWS CLI operations" },
    { pattern: /^az\s+(vm|aks|acr)\s/i, waitTime: 15000, description: "Azure CLI operations" },
    { pattern: /^terraform\s+(apply|plan|init)/i, waitTime: 60000, description: "Terraform operations" },

    // Database operations
    { pattern: /^(mysql|psql|mongo|redis-cli)\s/i, waitTime: 5000, description: "Database CLI" },
    { pattern: /^pg_dump\s/i, waitTime: 30000, description: "PostgreSQL dump" },
    { pattern: /^mongodump\s/i, waitTime: 30000, description: "MongoDB dump" },

    // File operations
    { pattern: /^(rsync|scp)\s/i, waitTime: 30000, description: "File sync/copy" },
    { pattern: /^tar\s.*[cxz]/i, waitTime: 15000, description: "Tar archive" },
    { pattern: /^(zip|unzip|gzip|gunzip)\s/i, waitTime: 10000, description: "Compression" },
    { pattern: /^find\s+\/.*-exec/i, waitTime: 20000, description: "Find with exec" },

    // Test runners
    { pattern: /^(pytest|jest|mocha|rspec|go\s+test)\s/i, waitTime: 30000, description: "Test runner" },
    { pattern: /^npm\s+(test|run\s+test)/i, waitTime: 30000, description: "npm test" },

    // System operations
    { pattern: /^systemctl\s+(restart|reload)/i, waitTime: 10000, description: "Systemctl restart" },
    { pattern: /^service\s+\S+\s+(restart|reload)/i, waitTime: 10000, description: "Service restart" },

    // Network operations
    { pattern: /^curl\s/i, waitTime: 10000, description: "curl request" },
    { pattern: /^wget\s/i, waitTime: 15000, description: "wget download" },

    // Quick commands - reduce wait time
    { pattern: /^(ls|pwd|whoami|hostname|date|uptime|echo)\s*$/i, waitTime: 500, description: "Quick info command" },
    { pattern: /^(ls|ll|la)\s+-?\w*\s*$/i, waitTime: 500, description: "Directory listing" },
    { pattern: /^cat\s+\S+$/i, waitTime: 1000, description: "Cat file" },
    { pattern: /^head\s/i, waitTime: 1000, description: "Head" },
    { pattern: /^tail\s+[^f]/i, waitTime: 1000, description: "Tail (non-follow)" },
    { pattern: /^grep\s/i, waitTime: 3000, description: "Grep" },
    { pattern: /^wc\s/i, waitTime: 1000, description: "Word count" },

    // Environment
    { pattern: /^(env|export|printenv)(\s|$)/i, waitTime: 500, description: "Environment" },
    { pattern: /^source\s/i, waitTime: 2000, description: "Source file" },
  ],
};

export class SmartWait {
  private config: SmartWaitConfig;

  constructor(config: SmartWaitConfig = DEFAULT_SMART_WAIT_CONFIG) {
    this.config = config;
  }

  /**
   * Calculate the appropriate wait time for a command
   */
  getWaitTime(command: string, explicitWaitTime?: number): number {
    // If explicit wait time provided, use it
    if (explicitWaitTime !== undefined) {
      return explicitWaitTime;
    }

    const trimmedCommand = command.trim();

    // Check each pattern
    for (const { pattern, waitTime } of this.config.patterns) {
      if (pattern.test(trimmedCommand)) {
        return waitTime;
      }
    }

    // Default wait time
    return this.config.baseWaitTime;
  }

  /**
   * Get description of why a wait time was chosen
   */
  getWaitTimeReason(command: string): string | null {
    const trimmedCommand = command.trim();

    for (const { pattern, description } of this.config.patterns) {
      if (pattern.test(trimmedCommand)) {
        return description;
      }
    }

    return null;
  }

  /**
   * Check if command is likely to be long-running
   */
  isLongRunning(command: string): boolean {
    return this.getWaitTime(command) > 10000;
  }

  /**
   * Check if command is likely to be quick
   */
  isQuickCommand(command: string): boolean {
    return this.getWaitTime(command) <= 1000;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: RegExp, waitTime: number, description: string): void {
    this.config.patterns.unshift({ pattern, waitTime, description });
  }

  /**
   * Update base wait time
   */
  setBaseWaitTime(waitTime: number): void {
    this.config.baseWaitTime = waitTime;
  }
}

// Singleton instance
export const smartWait = new SmartWait();
