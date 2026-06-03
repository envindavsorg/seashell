#!/usr/bin/env zsh

# options
setopt AUTO_CD PUSHD_IGNORE_DUPS SHARE_HISTORY
setopt COMPLETE_IN_WORD NO_BEEP

# history
HISTFILE=~/.zsh_history
HISTSIZE=50000
SAVEHIST=50000

# path
typeset -U path
path=(
  $HOME/.local/bin
  /opt/homebrew/bin
  /usr/local/bin
  $path[@]
)

# exports
export EDITOR="code -w"
export LANG="en_US.UTF-8"

# Starship prompt
command -v starship &>/dev/null && eval "$(starship init zsh)"

# kill process on port
killport() {
  [[ -z "$1" ]] && { echo "usage: killport <port>"; return 1; }
  local pids=$(lsof -ti:$1 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null && echo "freed port $1"
  else
    echo "no process on port $1"
  fi
}

# keybindings
bindkey -e
bindkey '^P' history-search-backward

# aliases
alias ..="cd .."
alias c="clear"
alias sz="source ~/.zshrc"
alias ll="ls -lAFh"

# local config
[ -f ~/.zshrc.local ] && source ~/.zshrc.local
