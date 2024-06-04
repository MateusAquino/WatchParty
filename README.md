# WatchParty

This is a WIP project.

## Client/Server communication

### Server Connection

Connection protocol params must be separated by `#` and encoded (`encodeURIComponent`):

#### Create Party

- protocol: `c`
- param[1]: WatchParty protocol version
- param[2]: Username (string)
- param[3]: Party Password (string)
- param[4]: Party Name (string)
- param[5]: Join as Host? (1/0)

Usage example: `c#1#John#123#Example%20Party#1`

#### Join Party

- protocol: `j`
- param[1]: WatchParty protocol version
- param[2]: Username (string)
- param[3]: Party Code (string)
- param[4]: Party Password (string)

Usage example: `c#1#Jane#LJ7HLC#123`

### Packets

#### Server Packets

`upgrade` -> Sent if protocol version mismatch
`party:<party>` -> Returns a JSON party whenever there is a host/clients update
`msg:<id>:<msg>` -> Returns the user id and the message broadcasted to the party
`cmd:<cmd>` -> Returns a JSON command used by WatchParty to sync actions (play/pause/...)
`badroom` -> Sent if room code/password is wrong

Note: party packet returns the generated code, the first letter should be unique for each server (or "L" for local)

#### Client Packets

`msg:<msg>` -> Broadcasts message to party
`toggle:<userId>` -> Toggles user host privileges (must be a host & > 1 host in the party)
`cmd:<cmd>` -> Broadcasts JSON command to party (must be a host)
