# yaziconfig
```yaziconfig
cat yazi.toml && cat keymap.toml
[mgr]
show_hidden = true

edit = [
    { run = 'nvim "$@"', desc = "Neovim", block = true, for = "unix" },
    { run = 'vim "$@"', desc = "Vim", block = true, for = "unix" },
]
[[mgr.prepend_keymap]]
on = [ "g", "d" ]
run = "cd ~/Downloads"
desc = "跳转到 Downloads"

[[mgr.prepend_keymap]]
on = [ "g", "p" ]
run = "cd ~/Pictures"
desc = "跳转到 Pictures"

[[mgr.prepend_keymap]]
on = [ "g", "h" ]
run = "cd ~"
desc = "跳转到 Home"

[[mgr.prepend_keymap]]
on = [ "T" ]
run = 'shell --confirm --block "kitty --directory=\"$PWD\""'
desc = "在当前目录打开 Kitty"

[[mgr.prepend_keymap]]
on = [ "g", "j" ]
run = "cd ~/Projects"
desc = "跳转到 Pictures"

[[mgr.prepend_keymap]]
on = [ "g", "v" ]
run = "cd ~/Videos/"
desc = "跳转到 video"
```