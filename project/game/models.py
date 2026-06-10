from project.game.conundrums import CONUNDRUMS
from project.auth.models import AnonymousUser
from project.extensions import cache, socketio
from english_words import get_english_words_set

import typing as t 
import enum as e
import secrets
import random


class GameState(e.Enum):
    WAITING = 0
    ROUND_NEW = 1
    ROUND_LETTERS = 2
    ROUND_NUMBERS = 3
    ROUND_CONUNDRUM = 4
    ROUND_COUNTDOWN = 5
    ROUND_ANSWER = 6
    ROUND_REVEAL = 7
    ROUND_END = 8


class RoundDict(t.TypedDict):
    round_number: int
    game_mode: int      # 0 is letters 1 is numbers
    starting_team: int
    starting_player: int
    game_data: dict[str, list] | None

    player_11: int
    player_12: int | None
    player_21: int
    player_22: int | None


class RoomDict(t.TypedDict):
    id: str
    token: str
    team_size: int

    state: str
    round_number: int
    round: RoundDict
    round_private: dict[str, list]

    creator_id: str
    player_ids: list[str]
    team_1_ids: list[str]
    team_2_ids: list[str]
    team_1_points: int
    team_2_points: int


VOWELS_LOOKUP = {'A', 'E', 'I', 'O', 'U'}
VOWELS = list("AAAAAEEEEEEEEIIIIIOOOOOOUUU")
CONSONANTS = list("BBCCDDDDFFGGGHHJKLLLLMMNNNNNPPQRRRRRRSSSSSSTTTTTTVVWWXYZ")

LARGE_NUMBERS = [25, 50, 75, 100]
SMALL_NUMBERS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]


WORDS = {
    word for word in get_english_words_set(["web2"], lower=True) 
    if 2 <= len(word) <= 9
}

def is_valid_word(word: str) -> bool:
    return word.lower() in WORDS


class Room:
    id: str
    token: str
    team_size: int

    state: GameState
    round_number: int
    round: RoundDict
    round_private: dict[str, list]

    creator: AnonymousUser
    players: list[AnonymousUser]
    team_1: list[AnonymousUser]
    team_2: list[AnonymousUser]
    team_1_points: int
    team_2_points: int

    def __init__(self, team_size: int, creator: AnonymousUser) -> None:
        self.id = str(random.randint(100000, 999999))
        self.token = secrets.token_urlsafe(32)
        self.team_size = team_size

        self.state = GameState.WAITING
        self.round_number = 0
        # Assure to be set when calling .start()
        self.round = {} # type: ignore
        self.round_private = {}

        self.players = []
        self.team_1 = []
        self.team_2 = []
        self.team_1_points = 0
        self.team_2_points = 0

        self.creator = creator
        self.add_player(creator)

        self.save()

    @classmethod
    def get(cls, id: str | None) -> "Room | None":
        if not id: return
        
        room = cache.get(id)
        if not room: return

        return Room.from_cache(room)
    
    @classmethod
    def from_cache(cls, data: RoomDict) -> "Room":
        room = cls.__new__(cls)

        for field, value in data.items():
            if field == "creator_id":
                room.creator = AnonymousUser.get(data["creator_id"], True)
                continue

            if field == "player_ids":
                room.players = [AnonymousUser.get(id, True) for id in data["player_ids"]]
                continue
            
            if field == "team_1_ids":
                room.team_1 = [AnonymousUser.get(id, True) for id in data["team_1_ids"]]
                continue
            
            if field == "team_2_ids":
                room.team_2 = [AnonymousUser.get(id, True) for id in data["team_2_ids"]]
                continue

            if field == "state":
                room.state = GameState[value] # type: ignore
                continue

            setattr(room, field, value)
        
        return room
    
    def add_player(self, player: AnonymousUser) -> bool:
        if len(self.players) == self.team_size * 2:
            player.room_id = None
            return False
        
        if not player in self.players:
            player.player_id = len(self.players)
            self.players.append(player)

            socketio.emit("player_join", player.serialize_player(), to=self.id)
        
        player.room_id = self.id
        return True
    
    def start(self) -> None:
        random.shuffle(self.players)
        
        # ASSUMPTION: If one team is not set, the other is also not set
        if not self.team_1:
            if self.team_size == 1:
                self.team_1 = [self.players[0]]
                self.team_2 = [self.players[1]]
            else:
                self.team_1 = [self.players[0], self.players[1]]
                self.team_2 = [self.players[2], self.players[3]]

        for player in self.team_1:
            player.team_id = 1
            player.save()

        for player in self.team_2:
            player.team_id = 2
            player.save()
        
        self.round = {
            "game_mode": round(random.random()),
            "round_number": -1, "starting_team": round(random.random()) + 1,
            "starting_player": t.cast(int, random.choice(self.players).player_id),
            "player_11": t.cast(int, self.team_1[0].player_id), "player_12": self.team_1[1].player_id if self.team_size == 2 else None,
            "player_21": t.cast(int, self.team_2[0].player_id), "player_22": self.team_2[1].player_id if self.team_size == 2 else None,
            "game_data": None
        }
    

    def _letters_round(self) -> dict[str, list]:
        self.round_private = {
            # We use weighted distributions as the real game does, in order to
            # somewhat control the random outcomes.
            "VOWELS": random.sample(VOWELS, len(VOWELS)),
            "CONSONANTS": random.sample(CONSONANTS, len(CONSONANTS)),
        }

        return {
            "letters": [],
        }
    
    def _numbers_round(self) -> dict[str, list]:
        self.round_private = {
            "TARGET": [random.randint(101, 999)],
            # We use weighted distributions as the real game does, in order to
            # somewhat control the random outcomes.
            "LARGE": random.sample(LARGE_NUMBERS, len(LARGE_NUMBERS)),
            "SMALL": random.sample(SMALL_NUMBERS, len(SMALL_NUMBERS))
        }

        return {
            "large": [],
            "small": [],
        }

    def _all_round_data(self) -> RoundDict:
        ids = [player.player_id for player in self.players]
        
        return {
            "game_mode": int(not self.round["game_mode"]),
            "round_number": self.round_number,
            "starting_team": ((self.round["starting_team"] + 1) % 2) + 1,
            "starting_player": t.cast(int, ids[(ids.index(self.round["starting_player"]) + 1) % len(ids)]),
            "player_11": t.cast(int, self.team_1[0].player_id), "player_12": self.team_1[1].player_id if self.team_size == 2 else None,
            "player_21": t.cast(int, self.team_2[0].player_id), "player_22": self.team_2[1].player_id if self.team_size == 2 else None,
            "game_data": None
        }

    def _all_round(self) -> None:
        new_round = self._all_round_data()

        socketio.emit("round_new", new_round, to=self.id)
        self.round = new_round

    def _specific_round(self) -> None:
        new_round = self._all_round_data()

        socketio.emit("round_new", new_round, to=self.id)
        self.round = new_round

    def _conundrum(self) -> None:
        conundrum = random.choice(CONUNDRUMS)

        new_round = self._all_round_data()
        new_round["game_mode"] = 2
        new_round["game_data"] = {
            "conundrum": [conundrum[0]],
        }
        self.round_private = {
            "CONUNDRUM": [conundrum[1]]
        }
        
        socketio.emit("round_new", new_round, to=self.id)
        self.round = new_round
    
    def prepare_next_round(self) -> None:
        self.state = GameState.ROUND_NEW

        # Both games are played (in random order in a 2v2 manner)
        if self.round_number < 2:
            self._all_round()

        # This depends on whether is a 1v1 or a 2v2
        # In a 1v1 this is more of the same, in a 2v2 these are two random rounds
        # where two different opponents face each other
        elif self.round_number < 4:
            if self.team_size == 1: self._all_round()
            else: self._specific_round()

        # This depends on whether it is a 1v1 or a 2v2
        # 1v1 ends here with a conundrum, 2v2 continues with anohter general round
        elif self.team_size == 1:
            return self._conundrum()

        elif self.round_number < 6:
            self._all_round()

        else:
            return self._conundrum()

        self.round_number += 1

        if self.round["game_mode"] == 0:
            self.round["game_data"] = self._letters_round()
            return

        if self.round["game_mode"] == 1:
            self.round["game_data"] = self._numbers_round()
            return


    def pick(self, type: int) -> None:
        assert self.round["game_data"] != None, "whut"

        if self.round["game_mode"] == 0:
            letters = self.round["game_data"]["letters"]

            total = len(letters)
            if total >= 9: 
                return

            vowels = sum(1 for string in letters for char in string if char in VOWELS_LOOKUP)
            consonants = total - vowels

            if vowels == 5: type = 0
            elif consonants == 6: type = 1
            elif (9 - total) == (4 - consonants): type = 0
            elif (9 - total) == (3 - vowels): type = 1

            if type == 1:
                letters.append(self.round_private["VOWELS"].pop())

            else:
                letters.append(self.round_private["CONSONANTS"].pop())
        
        elif self.round["game_mode"] == 1:
            large_picked = len(self.round["game_data"]["large"])
            small_picked = len(self.round["game_data"]["small"])
            total_picked = large_picked + small_picked

            if total_picked >= 6: return

            if large_picked == 4: type = 0
            elif small_picked == 6: type = 1
            elif (6 - total_picked) == (2 - small_picked): type = 0

            if type == 1:
                number = self.round_private["LARGE"].pop()
                self.round["game_data"]["large"].append(number)
            else:
                number = self.round_private["SMALL"].pop()
                self.round["game_data"]["small"].append(number)


    @classmethod
    def _evaluate_letters(cls, room: RoomDict) -> list:
        # List of tuples (player_id, team, value, answer)
        answers = []

        for id in room["player_ids"]:
            player = AnonymousUser.get(id, True)

            if not isinstance(player.answer, str): continue
            if len(player.answer) > 9: continue
            if len(player.answer) < 2: continue
            if not is_valid_word(player.answer): continue

            answers.append((player.player_id, player.team_id, len(player.answer), player.answer))
            player.answer = None
            player.save()

        answers.sort(key=lambda x: x[2], reverse=True)

        socketio.emit("round_replies", answers, to=room["id"])

        print("[ANSWERS]", answers)

        # If both teams compete for the same score in a letters game
        if len(answers) > 1 and (answers[0][2] == answers[1][2] and answers[0][1] != answers[1][1]):
            # Add 18 if a word of 9, otherwise the length of the word
            room[f"team_{answers[0][1]}_points"] += 18 if answers[0][2] == 9 else answers[0][2]
            room[f"team_{answers[1][1]}_points"] += 18 if answers[0][2] == 9 else answers[0][2]
            socketio.emit("round_result", answers[:2], to=room["id"])
            return answers

        if len(answers) == 1:
            room[f"team_{answers[0][1]}_points"] += 18 if answers[0][2] == 9 else answers[0][2]
            socketio.emit("round_result", answers[:1], to=room["id"])
            return answers

        socketio.emit("round_result", [], to=room["id"])
        return answers

    @classmethod
    def _evaluate_numbers(cls, room: RoomDict, verified: bool) -> list:
        answers = []

        for id in room["player_ids"]:
            player = AnonymousUser.get(id, True)
            if player.answer == None: continue

            try:
                # Your points are equal to (10 - | target - answer |) -> bang on = 10, and goes down from there
                # Can not be lower than 0 points. Only solutions worth more than 0 are verified
                points = max(10 - abs(room["round_private"]["TARGET"][0] - (int(player.answer) or 0)), 0)
            except:
                player.answer = None
                player.save()
                continue

            if points > 0:
                answers.append((player.player_id, player.team_id, points, player.answer))

            player.answer = None
            player.save()

        print("[ANSWERS]", answers)

        if verified:
            socketio.emit("round_result", answers, to=room["id"])
            return answers

        socketio.emit("round_replies", answers, to=room["id"])
        for i in range(len(answers)):
            socketio.emit("round_verify", answers[i][0], to=room["id"])

        return answers


    @classmethod
    def evaluate_answers(cls, room: RoomDict, verified: bool) -> list:
        if room["round"]["game_mode"] == 0:
            return cls._evaluate_letters(room)

        if room["round"]["game_mode"] == 1:
            return cls._evaluate_numbers(room, verified)     

        if room["round"]["game_mode"] == 2:
            socketio.emit("round_result", [[-1, -1, -1, room["round_private"]["CONUNDRUM"]]], to=room["id"])
            return [] 

        return []  


    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=12 * 60 * 60)

    def serialize(self) -> RoomDict:
        return {
            "id": self.id,
            "token": self.token,
            "team_size": self.team_size,
            "round_number": self.round_number,
            "round": self.round,
            "round_private": self.round_private,
            "state": self.state.name,
            "creator_id": self.creator.id,
            "player_ids": [player.id for player in self.players],
            "team_1_ids": [player.id for player in self.team_1],
            "team_2_ids": [player.id for player in self.team_2],
            "team_1_points": self.team_1_points,
            "team_2_points": self.team_2_points
        }
    
    def serialize_game(self) -> dict[str, t.Any]:
        return {
            "token": self.token,
            "team_size": self.team_size,
            "state": self.state.name,
            "creator": self.creator.serialize_player(),
            "team_1": [player.serialize_player() for player in self.team_1],
            "team_1_points": self.team_1_points,
            "team_2": [player.serialize_player() for player in self.team_2],
            "team_2_points": self.team_2_points,
            "players": [player.serialize_player() for player in self.players]
        }
