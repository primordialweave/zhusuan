// Command migrate-credentials copies one remembered server login to the new application identity.
// Passwords remain in the operating system keyring and are never printed.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/primordialweave/zhusuan/internal/desktop"
)

func main() {
	scope := flag.String("scope", "zhusuan-desktop/api/v1", "Remembered server login scope")
	flag.Parse()
	credentials, err := desktop.NewCredentialStore().Load(*scope)
	if err != nil {
		fmt.Fprintln(os.Stderr, "记住的登录信息暂未迁移，请在系统钥匙串中检查授权")
		os.Exit(1)
	}
	fmt.Printf("记住的登录信息已迁移或已存在：%t\n", credentials != nil)
}
