::: header
# Shoutcast DNAS Server Source Support {#shoutcast-dnas-server-source-support align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
| - [2 How It Works](#How_It_Works)                                     |
| - [3 How To Do It](#How_To_Do_It)                                     |
|   - [3.1 DJ / User ID](#DJ_/_User_ID)                                 |
| - [4 Is There Anything Else?](#Is_There_Anything_Else?)               |
| - [5 Additional Information](#Additional_Information)                 |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

The Shoutcast DNAS server since the introduction of v2.0 has been able
to provide multiple streams from a single DNAS server instance. To be
able to do this, it has required the source for the stream to be a relay
(pulling a copy of the stream from another server) or by using Shoutcast
2 protocol compatible source client software (where you specify the
stream number to connect to as part of the source configuration).

The downside of this is that unless you are relaying or using an updated
source client, existing source client software which is only Shoutcast 1
protocol compatible has only been able to connect as the source from
stream #1 (due to not being able to indicate the required stream
number). There was a partial workaround by using the
\'streamportlegacy\' option but this had issues and was marked as an
experimental feature.

With the release of the v2.4.7 DNAS server (and future versions), not
being able to use multiple Shoutcast 1 protocol compatible source
software to connect as the source for any stream on the DNAS server has
now been removed. The changes to support this will typically not require
any source client software updates as this is all handled by the DNAS
server as long as the correct password is provided.

\

[]{#How_It_Works}

## 2. How It Works [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

With the Shoutcast 2 protocol, the ability to specify the desired stream
for the source client to be used for is a core part of the protocol via
the required stream identifier. Whereas the Shoutcast 1 protocol was
designed before it was considered to be able to provide multiple streams
from a single DNAS server instance (as the v2.x DNAS server supports)
and so there is no direct means in the protocol to specify the stream
identifier.

All Shoutcast source client connections require a password to be
provided irrespective of the Shoutcast protocol version being used and
with the Shoutcast 1 protocol, this is the first primary piece of
information sent to the DNAS server when the source is attempting to
connect.

By manipulating the password provided from a Shoutcast 1 protocol
compatible source client to also include the intended stream identifier,
it is now possible for the DNAS server to know the intended stream the
source client is to be used for. This is what will now allow for the
v2.4.7 DNAS server (and future versions) to be able to support multiple
Shoutcast 1 protocol compatible source clients along with the added
benefit of not requiring source client software updates (though native
Shoutcast 2 protocol support is preferred over Shoutcast 1 protocol
based source clients).

\

[]{#How_To_Do_It}

## 3. How To Do It [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To connect a Shoutcast 1 protocol compatible source client to a specific
stream then you can append :**#\<sid\>** to the end of the password to
be used so you have **\<password\>:#\<sid\>** (where \<password\> is the
configured stream password and \<sid\> is the required stream
identifier).

e.g.

to connect to **stream #2** with the configured password as **bob**

the value to enter in the source client password field is: **bob:#2**

    stream #1 is the default stream assumed for a Shoutcast 1 protocol compatible source client
    and so it is not necessary to add :#1 to the end of the password, though it is ok to do this

The colon character is now a reserved character and cannot be used as a
value in passwords. If the DNAS server detects a colon then the password
will be rejected and the DNAS server may abort running.

\

[]{#DJ_/_User_ID}

## 3.1. DJ / User ID [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

In addition to the ability to provide the stream identifier, it is also
possible to provide a DJ / User ID for the source connection. This is
done in a similar manner but places the DJ / User ID value at the start
of the password field

e.g.

**\<dj\<:\<password\>**

or

**\<dj\>:\<password\>:#\<sid\>**

    <dj> is the value to send
    <password> is the configured stream password
    <sid> is the required stream identifier

This support is currently used just to see which DJ / User is connected
as the source client for the stream, however in future DNAS releases
then this may be used as a way to do additional controlling of the
source client connections to the DNAS server.

\

[]{#Is_There_Anything_Else?}

## 4. Is There Anything Else? [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To ensure that Shoutcast 1 protocol compatible source clients areable to
access the DNAS server, you may need to open an additional port to just
[**portbase**](DNAS_Server.html#Networking) to allow the source
connection to be made if it is not from the same machine or the same
local network as the DNAS server i.e. you are making an external source
connection.

    If the source is running on the same machine or local network then you
    will not need to open any additional ports for the connection to work.

\
How to do this will depend upon your setup but often requires ports to
be opened on the router and in the Operating System\'s firewall. You
should be able to find information for your router on how to do port
forwarding from [**www.portforward.com**](http://www.portforward.com)
(which only requires TCP connections to be forwarded and not UDP
connections).

Usually you will be forwarding port 8000 as well as port 8001 (which is
the actual port that the Shoutcast 1 protocol uses for source
connections). If you have changed
[**portbase**](DNAS_Server.html#Networking) from it\'s default value
then you will need to ensure that **portbase+1** is opened so that the
external source connection can be made. You can use
[**www.yougetsignal.com/tools/open-ports**](http://www.yougetsignal.com/tools/open-ports/)
to confirm that the port forwarding is working correctly (just ensure
the DNAS server is actually running at the time!).

    If not done correctly then the source connection will fail
    either due to a connection timeout or an unknown error code.

\

[]{#Additional_Information}

## 5. Additional Information [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![View Source Connection
Details](res/View_Source_Connection_Details.png){.thumb}](res/View_Source_Connection_Details.png "View Source Connection Details")
:::

If you are still unsure about what to enter into the source client
password field, the **View Source Connection Details** page (found on
the DNAS server admin summary page) which shows the appropriate password
to use for the different Shoutcast protocol source clients via the
**Password** and **Legacy Password** values shown.

\
